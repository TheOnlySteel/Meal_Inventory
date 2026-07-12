-- Planner: entries can be assigned to a member (who's cooking), mirroring
-- chores.assigned_to. Null = anyone.

alter table public.plan_entries
  add column assigned_to uuid references auth.users (id) on delete set null;
