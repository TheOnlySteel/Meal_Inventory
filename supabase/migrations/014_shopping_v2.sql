-- Shopping v2: items carry a store (grocery vs Costco run) and an aisle
-- category, and the household's item_catalog remembers both per item name so
-- re-adds land in the right place automatically.

alter table public.shopping_items
  add column store text not null default 'grocery',
  add column category text;

-- Free text by design: a future third store is a UI change, not a migration.

create table public.item_catalog (
  household_id uuid not null references public.households (id) on delete cascade,
  name_key text not null,
  display_name text not null,
  category text,
  store text not null default 'grocery',
  times_added int not null default 1,
  last_added_at timestamptz not null default now(),
  primary key (household_id, name_key)
);

alter table public.item_catalog enable row level security;

create policy "member read catalog" on public.item_catalog
  for select to authenticated using (public.is_household_member(household_id));
create policy "member insert catalog" on public.item_catalog
  for insert to authenticated with check (public.is_household_member(household_id));
create policy "member update catalog" on public.item_catalog
  for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "member delete catalog" on public.item_catalog
  for delete to authenticated using (public.is_household_member(household_id));

-- Learn from every list insert: bump counters and remember the item's
-- category/store. Explicit values win; nulls keep what was learned.
create or replace function public.remember_shopping_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(trim(new.name)) = 0 then
    return new;
  end if;
  insert into public.item_catalog (household_id, name_key, display_name, category, store)
       values (new.household_id, lower(trim(new.name)), trim(new.name), new.category, new.store)
  on conflict (household_id, name_key) do update
     set times_added = public.item_catalog.times_added + 1,
         last_added_at = now(),
         display_name = excluded.display_name,
         category = coalesce(excluded.category, public.item_catalog.category),
         store = excluded.store;
  return new;
end
$$;

-- Trigger functions must not be callable via PostgREST RPC (matches 005).
revoke all on function public.remember_shopping_item() from public, anon, authenticated;

create trigger shopping_remember_item
  after insert on public.shopping_items
  for each row execute function public.remember_shopping_item();

-- Seed the catalog from what's already on household lists.
insert into public.item_catalog (household_id, name_key, display_name)
select distinct on (household_id, lower(trim(name)))
       household_id, lower(trim(name)), trim(name)
  from public.shopping_items
 where length(trim(name)) > 0
 order by household_id, lower(trim(name)), created_at desc
on conflict do nothing;

alter publication supabase_realtime add table public.item_catalog;
