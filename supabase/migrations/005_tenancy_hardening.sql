-- Advisor follow-ups for 004: trigger functions should not be callable via
-- PostgREST RPC, and household updates must stay owner-checked after the write.

revoke all on function public.set_household_from_membership() from public, anon, authenticated;
revoke all on function public.set_log_household() from public, anon, authenticated;

drop policy "owner update household" on public.households;
create policy "owner update household" on public.households
  for update to authenticated
  using (exists (
    select 1 from public.household_members m
    where m.household_id = id and m.user_id = auth.uid() and m.role = 'owner'
  ))
  with check (exists (
    select 1 from public.household_members m
    where m.household_id = id and m.user_id = auth.uid() and m.role = 'owner'
  ));
