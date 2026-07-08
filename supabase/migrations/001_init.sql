-- Larder: meal prep inventory schema
create table public.meals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  prep_date date not null,
  shelf_life_weeks numeric not null check (shelf_life_weeks > 0),
  best_before date generated always as (prep_date + (shelf_life_weeks * 7)::int) stored,
  servings_per_pack numeric not null default 1 check (servings_per_pack > 0),
  pack_quantity int not null default 0 check (pack_quantity >= 0),
  initial_pack_quantity int not null default 0 check (initial_pack_quantity >= 0),
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
  archived_at timestamptz,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meal_log (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals (id) on delete cascade,
  packs int not null default 1,
  logged_at timestamptz not null default now(),
  user_id uuid references auth.users (id) default auth.uid()
);

create index meals_best_before_idx on public.meals (best_before) where archived_at is null;
create index meal_log_logged_at_idx on public.meal_log (logged_at desc);
create index meal_log_meal_id_idx on public.meal_log (meal_id);

-- Shared household model: any authenticated user has full access, no anon access.
alter table public.meals enable row level security;
alter table public.meal_log enable row level security;

create policy "household read meals" on public.meals
  for select to authenticated using (true);
create policy "household insert meals" on public.meals
  for insert to authenticated with check (true);
create policy "household update meals" on public.meals
  for update to authenticated using (true) with check (true);
create policy "household delete meals" on public.meals
  for delete to authenticated using (true);

create policy "household read log" on public.meal_log
  for select to authenticated using (true);
create policy "household insert log" on public.meal_log
  for insert to authenticated with check (true);
create policy "household update log" on public.meal_log
  for update to authenticated using (true) with check (true);
create policy "household delete log" on public.meal_log
  for delete to authenticated using (true);

-- Live updates for the kiosk dashboard
alter publication supabase_realtime add table public.meals;
alter publication supabase_realtime add table public.meal_log;
