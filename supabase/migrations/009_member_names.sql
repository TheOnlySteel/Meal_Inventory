-- Display names for household members, so chores can be assigned to people.

alter table public.household_members add column display_name text;

-- Backfill from email prefix (runs as postgres; may read auth.users).
update public.household_members m
   set display_name = split_part(u.email, '@', 1)
  from auth.users u
 where u.id = m.user_id and m.display_name is null;

-- Members may edit only their own row, and only display_name. RLS cannot
-- restrict columns, so pair the policy with a column-level grant — otherwise
-- a member could set their own role to 'owner'.
revoke update on public.household_members from authenticated;
grant update (display_name) on public.household_members to authenticated;

create policy "update own membership" on public.household_members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Re-create the lifecycle RPCs so new memberships start with a default name.
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
  insert into public.household_members (household_id, user_id, role, display_name)
    values (v_id, auth.uid(), 'owner',
            (select split_part(email, '@', 1) from auth.users where id = auth.uid()));
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
  insert into public.household_members (household_id, user_id, display_name)
    values (v_h.id, auth.uid(),
            (select split_part(email, '@', 1) from auth.users where id = auth.uid()))
    on conflict do nothing;
  return jsonb_build_object('id', v_h.id, 'name', v_h.name);
end
$$;
