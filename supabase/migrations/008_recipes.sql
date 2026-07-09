-- Recipe book: reusable templates that seed inventory meals.

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  ingredients text not null default '',   -- one ingredient per line
  instructions text not null default '',
  servings_per_pack numeric not null default 1 check (servings_per_pack > 0),
  default_storage_location text not null default 'freezer'
    check (default_storage_location in ('freezer', 'fridge', 'shelf')),
  default_shelf_life_days int not null default 84 check (default_shelf_life_days > 0),
  notes text,
  calories numeric check (calories >= 0),
  protein_g numeric check (protein_g >= 0),
  fat_g numeric check (fat_g >= 0),
  carbs_g numeric check (carbs_g >= 0),
  fibre_g numeric check (fibre_g >= 0),
  sugar_g numeric check (sugar_g >= 0),
  sat_fat_g numeric check (sat_fat_g >= 0),
  sodium_mg numeric check (sodium_mg >= 0),
  iron_mg numeric check (iron_mg >= 0),
  potassium_mg numeric check (potassium_mg >= 0),
  calcium_mg numeric check (calcium_mg >= 0),
  vit_c_mg numeric check (vit_c_mg >= 0),
  vit_d_ug numeric check (vit_d_ug >= 0),
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recipes_household_idx on public.recipes (household_id);

alter table public.recipes enable row level security;

create policy "member read recipes" on public.recipes
  for select to authenticated using (public.is_household_member(household_id));
create policy "member insert recipes" on public.recipes
  for insert to authenticated with check (public.is_household_member(household_id));
create policy "member update recipes" on public.recipes
  for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "member delete recipes" on public.recipes
  for delete to authenticated using (public.is_household_member(household_id));

create trigger recipes_set_household before insert on public.recipes
  for each row execute function public.set_household_from_membership();

alter publication supabase_realtime add table public.recipes;

-- Inventory rows remember their source recipe.
alter table public.meals
  add column recipe_id uuid references public.recipes (id) on delete set null;
create index meals_recipe_idx on public.meals (recipe_id);
