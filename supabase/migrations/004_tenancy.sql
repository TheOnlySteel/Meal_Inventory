-- Household multi-tenancy: households + memberships, household_id on all data,
-- membership-scoped RLS, invite-code join. Existing users and rows are folded
-- into a single default household.

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- Unambiguous 6-char code (no I/L/O/0/1)
create or replace function public.generate_invite_code()
returns text
language sql
volatile
set search_path = public
as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (floor(random() * 31) + 1)::int, 1), '')
  from generate_series(1, 6)
$$;

alter table public.households
  alter column invite_code set default public.generate_invite_code();

-- SECURITY DEFINER so policies on household_members can consult membership
-- without recursing into their own RLS.
create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = p_household_id and user_id = auth.uid()
  );
$$;

revoke all on function public.is_household_member(uuid) from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated;

alter table public.households enable row level security;
alter table public.household_members enable row level security;

create policy "member read household" on public.households
  for select to authenticated using (public.is_household_member(id));
create policy "owner update household" on public.households
  for update to authenticated
  using (exists (
    select 1 from public.household_members m
    where m.household_id = id and m.user_id = auth.uid() and m.role = 'owner'
  ))
  with check (true);

create policy "read own or shared memberships" on public.household_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_household_member(household_id));
create policy "leave household" on public.household_members
  for delete to authenticated using (user_id = auth.uid());
-- No insert policy: memberships are created only via the RPCs below.

-- Scope existing data --------------------------------------------------------

alter table public.meals add column household_id uuid references public.households (id);
alter table public.meal_log add column household_id uuid references public.households (id);

do $$
declare
  v_hid uuid;
  v_owner uuid;
begin
  select id into v_owner from auth.users order by created_at limit 1;
  if v_owner is not null then
    insert into public.households (name, created_by)
      values ('Home', v_owner) returning id into v_hid;
    insert into public.household_members (household_id, user_id, role)
      select v_hid, id, case when id = v_owner then 'owner' else 'member' end
      from auth.users;
    update public.meals set household_id = v_hid;
    update public.meal_log set household_id = v_hid;
  end if;
end $$;

alter table public.meals alter column household_id set not null;
alter table public.meal_log alter column household_id set not null;
create index meals_household_idx on public.meals (household_id);
create index meal_log_household_idx on public.meal_log (household_id);

-- Fill household_id on insert so clients never send it. BEFORE-insert triggers
-- run ahead of RLS WITH CHECK, so the membership policies see the final value.
create or replace function public.set_household_from_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.household_id is null then
    select household_id into new.household_id
      from public.household_members
     where user_id = auth.uid()
     order by created_at
     limit 1;
    if new.household_id is null then
      raise exception 'no household membership';
    end if;
  end if;
  return new;
end
$$;

create or replace function public.set_log_household()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.household_id is null then
    select household_id into new.household_id from public.meals where id = new.meal_id;
  end if;
  return new;
end
$$;

create trigger meals_set_household before insert on public.meals
  for each row execute function public.set_household_from_membership();
create trigger meal_log_set_household before insert on public.meal_log
  for each row execute function public.set_log_household();

-- Replace the shared-household policies with membership-scoped ones ----------

drop policy "household read meals" on public.meals;
drop policy "household insert meals" on public.meals;
drop policy "household update meals" on public.meals;
drop policy "household delete meals" on public.meals;
drop policy "household read log" on public.meal_log;
drop policy "household insert log" on public.meal_log;
drop policy "household update log" on public.meal_log;
drop policy "household delete log" on public.meal_log;

create policy "member read meals" on public.meals
  for select to authenticated using (public.is_household_member(household_id));
create policy "member insert meals" on public.meals
  for insert to authenticated with check (public.is_household_member(household_id));
create policy "member update meals" on public.meals
  for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "member delete meals" on public.meals
  for delete to authenticated using (public.is_household_member(household_id));

create policy "member read log" on public.meal_log
  for select to authenticated using (public.is_household_member(household_id));
create policy "member insert log" on public.meal_log
  for insert to authenticated with check (public.is_household_member(household_id));
create policy "member update log" on public.meal_log
  for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "member delete log" on public.meal_log
  for delete to authenticated using (public.is_household_member(household_id));

-- Household lifecycle RPCs ----------------------------------------------------

create or replace function public.create_household(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_code text;
  v_name text := nullif(trim(p_name), '');
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if v_name is null then raise exception 'name required'; end if;
  loop
    v_code := public.generate_invite_code();
    begin
      insert into public.households (name, invite_code, created_by)
        values (v_name, v_code, auth.uid())
        returning id into v_id;
      exit;
    exception when unique_violation then
      -- rare code collision: retry with a fresh code
    end;
  end loop;
  insert into public.household_members (household_id, user_id, role)
    values (v_id, auth.uid(), 'owner');
  return jsonb_build_object('id', v_id, 'name', v_name, 'invite_code', v_code);
end
$$;

create or replace function public.join_household(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_h public.households%rowtype;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v_h from public.households where invite_code = upper(trim(p_code));
  if not found then raise exception 'Invalid invite code'; end if;
  insert into public.household_members (household_id, user_id)
    values (v_h.id, auth.uid())
    on conflict do nothing;
  return jsonb_build_object('id', v_h.id, 'name', v_h.name);
end
$$;

revoke all on function public.create_household(text) from public, anon;
revoke all on function public.join_household(text) from public, anon;
revoke all on function public.generate_invite_code() from public, anon;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;

-- eat_pack: stamp the log row from the meal explicitly (belt-and-braces with
-- the trigger), now that meal_log.household_id exists.
create or replace function public.eat_pack(p_meal_id uuid, p_packs int default 1)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_meal public.meals%rowtype;
  v_new_qty int;
  v_depleted boolean;
  v_log_id uuid;
begin
  if p_packs < 1 then
    raise exception 'packs must be positive';
  end if;

  select * into v_meal from public.meals where id = p_meal_id for update;
  if not found then
    raise exception 'meal not found';
  end if;

  v_new_qty := greatest(v_meal.pack_quantity - p_packs, 0);
  v_depleted := v_new_qty = 0 and v_meal.pack_quantity > 0;

  update public.meals
     set pack_quantity = v_new_qty,
         archived_at = case when v_new_qty = 0 then coalesce(archived_at, now()) else archived_at end,
         updated_at = now()
   where id = p_meal_id;

  insert into public.meal_log (meal_id, packs, caused_depletion, household_id)
       values (p_meal_id, least(p_packs, greatest(v_meal.pack_quantity, 1)), v_depleted, v_meal.household_id)
    returning id into v_log_id;

  return jsonb_build_object('log_id', v_log_id, 'new_qty', v_new_qty, 'depleted', v_depleted);
end
$$;

-- Realtime for household tables (postgres_changes filters events per
-- subscriber via RLS, so members only see their own household's changes).
alter publication supabase_realtime add table public.households;
alter publication supabase_realtime add table public.household_members;
