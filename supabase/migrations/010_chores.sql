-- Chore tracker: one-off or recurring, assignable to household members.

create table public.chores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  notes text,
  assigned_to uuid references auth.users (id) on delete set null,
  due_date date,
  recur_interval_days int check (recur_interval_days > 0),  -- null = one-off
  completed_at timestamptz,           -- one-offs only
  last_completed_at timestamptz,
  -- schedule before the latest completion, kept so uncomplete_chore reverses exactly
  prev_due_date date,
  prev_last_completed_at timestamptz,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  check (recur_interval_days is null or completed_at is null)
);

create index chores_household_due_idx on public.chores (household_id, due_date);

alter table public.chores enable row level security;

create policy "member read chores" on public.chores
  for select to authenticated using (public.is_household_member(household_id));
create policy "member insert chores" on public.chores
  for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and (assigned_to is null or exists (
      select 1 from public.household_members hm
      where hm.household_id = chores.household_id and hm.user_id = assigned_to
    ))
  );
create policy "member update chores" on public.chores
  for update to authenticated
  using (public.is_household_member(household_id))
  with check (
    public.is_household_member(household_id)
    and (assigned_to is null or exists (
      select 1 from public.household_members hm
      where hm.household_id = chores.household_id and hm.user_id = assigned_to
    ))
  );
create policy "member delete chores" on public.chores
  for delete to authenticated using (public.is_household_member(household_id));

create trigger chores_set_household before insert on public.chores
  for each row execute function public.set_household_from_membership();

alter publication supabase_realtime add table public.chores;

-- Completion RPCs. SECURITY INVOKER: RLS enforces membership throughout.
-- p_today comes from the client so "today" is household-local, not UTC.
create or replace function public.complete_chore(p_chore_id uuid, p_today date default current_date)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v public.chores%rowtype;
begin
  select * into v from public.chores where id = p_chore_id for update;
  if not found then
    raise exception 'chore not found';
  end if;

  if v.recur_interval_days is null then
    if v.completed_at is not null then
      return jsonb_build_object('chore_id', p_chore_id, 'already', true);
    end if;
    update public.chores
       set completed_at = now(),
           prev_last_completed_at = last_completed_at,
           last_completed_at = now()
     where id = p_chore_id;
    return jsonb_build_object('chore_id', p_chore_id, 'recurring', false);
  end if;

  -- Recurring: completing late re-anchors to today; completing early keeps cadence.
  update public.chores
     set prev_due_date = due_date,
         prev_last_completed_at = last_completed_at,
         last_completed_at = now(),
         due_date = greatest(coalesce(due_date, p_today), p_today) + v.recur_interval_days
   where id = p_chore_id
   returning due_date into v.due_date;
  return jsonb_build_object('chore_id', p_chore_id, 'recurring', true, 'next_due', v.due_date);
end
$$;

create or replace function public.uncomplete_chore(p_chore_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v public.chores%rowtype;
begin
  select * into v from public.chores where id = p_chore_id for update;
  if not found then
    raise exception 'chore not found';
  end if;

  if v.recur_interval_days is null then
    update public.chores
       set completed_at = null,
           last_completed_at = prev_last_completed_at,
           prev_last_completed_at = null
     where id = p_chore_id;
  else
    if v.last_completed_at is null then
      return jsonb_build_object('chore_id', p_chore_id, 'noop', true);
    end if;
    update public.chores
       set due_date = prev_due_date,
           last_completed_at = prev_last_completed_at,
           prev_due_date = null,
           prev_last_completed_at = null
     where id = p_chore_id;
  end if;
  return jsonb_build_object('chore_id', p_chore_id);
end
$$;

revoke all on function public.complete_chore(uuid, date) from public, anon;
revoke all on function public.uncomplete_chore(uuid) from public, anon;
grant execute on function public.complete_chore(uuid, date) to authenticated;
grant execute on function public.uncomplete_chore(uuid) to authenticated;
