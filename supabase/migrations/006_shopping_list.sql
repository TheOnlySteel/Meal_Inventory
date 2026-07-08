-- Household shopping list.

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  quantity text,
  checked_at timestamptz,
  sort_order double precision not null default 0,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index shopping_items_household_idx
  on public.shopping_items (household_id, checked_at, created_at);

alter table public.shopping_items enable row level security;

create policy "member read shopping" on public.shopping_items
  for select to authenticated using (public.is_household_member(household_id));
create policy "member insert shopping" on public.shopping_items
  for insert to authenticated with check (public.is_household_member(household_id));
create policy "member update shopping" on public.shopping_items
  for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "member delete shopping" on public.shopping_items
  for delete to authenticated using (public.is_household_member(household_id));

create trigger shopping_set_household before insert on public.shopping_items
  for each row execute function public.set_household_from_membership();

alter publication supabase_realtime add table public.shopping_items;
