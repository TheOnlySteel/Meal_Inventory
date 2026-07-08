-- Meal planner: dated slot entries that either link an inventory meal or are
-- free-text "to make" items. Completing a linked entry eats a pack atomically.

create table public.plan_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  plan_date date not null,
  slot text not null check (slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  meal_id uuid references public.meals (id) on delete set null,
  title text,
  servings numeric not null default 1 check (servings > 0),
  notes text,
  completed_at timestamptz,
  -- ties a completed linked entry to its meal_log row so undo is exact
  log_id uuid references public.meal_log (id) on delete set null,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  check (meal_id is not null or (title is not null and length(trim(title)) > 0))
);

create index plan_entries_household_date_idx on public.plan_entries (household_id, plan_date);

alter table public.plan_entries enable row level security;

create policy "member read plan" on public.plan_entries
  for select to authenticated using (public.is_household_member(household_id));
create policy "member insert plan" on public.plan_entries
  for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and (
      meal_id is null
      or exists (
        select 1 from public.meals m
        where m.id = meal_id and m.household_id = plan_entries.household_id
      )
    )
  );
create policy "member update plan" on public.plan_entries
  for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "member delete plan" on public.plan_entries
  for delete to authenticated using (public.is_household_member(household_id));

create trigger plan_set_household before insert on public.plan_entries
  for each row execute function public.set_household_from_membership();

alter publication supabase_realtime add table public.plan_entries;

-- Completion RPCs (SECURITY INVOKER: membership enforced by RLS throughout) --

create or replace function public.complete_plan_entry(p_entry_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_entry public.plan_entries%rowtype;
  v_eat jsonb := null;
begin
  select * into v_entry from public.plan_entries where id = p_entry_id for update;
  if not found then
    raise exception 'plan entry not found';
  end if;
  if v_entry.completed_at is not null then
    return jsonb_build_object('entry_id', p_entry_id, 'already', true);
  end if;

  if v_entry.meal_id is not null then
    v_eat := public.eat_pack(v_entry.meal_id, 1);
    update public.plan_entries
       set completed_at = now(), log_id = (v_eat->>'log_id')::uuid
     where id = p_entry_id;
  else
    update public.plan_entries set completed_at = now() where id = p_entry_id;
  end if;

  return coalesce(v_eat, '{}'::jsonb) || jsonb_build_object('entry_id', p_entry_id);
end
$$;

create or replace function public.uncomplete_plan_entry(p_entry_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_entry public.plan_entries%rowtype;
begin
  select * into v_entry from public.plan_entries where id = p_entry_id for update;
  if not found then
    raise exception 'plan entry not found';
  end if;

  if v_entry.log_id is not null then
    perform public.undo_eat(v_entry.log_id);
  end if;
  update public.plan_entries
     set completed_at = null, log_id = null
   where id = p_entry_id;

  return jsonb_build_object('entry_id', p_entry_id);
end
$$;

revoke all on function public.complete_plan_entry(uuid) from public, anon;
revoke all on function public.uncomplete_plan_entry(uuid) from public, anon;
grant execute on function public.complete_plan_entry(uuid) to authenticated;
grant execute on function public.uncomplete_plan_entry(uuid) to authenticated;
