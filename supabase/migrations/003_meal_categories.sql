-- Storage locations (freezer/fridge/shelf), meal types, and shelf life in days.
-- best_before is a STORED generated column, so it must be dropped and recreated
-- to change its expression from weeks to days; its partial index goes with it.

alter table public.meals
  add column storage_location text not null default 'freezer'
    check (storage_location in ('freezer', 'fridge', 'shelf')),
  add column meal_type text not null default 'meal'
    check (meal_type in ('meal', 'component', 'ingredient')),
  add column shelf_life_days int;

update public.meals
   set shelf_life_days = greatest(round(shelf_life_weeks * 7)::int, 1);

alter table public.meals
  alter column shelf_life_days set not null,
  add constraint meals_shelf_life_days_check check (shelf_life_days > 0);

drop index public.meals_best_before_idx;
alter table public.meals drop column best_before;
alter table public.meals
  add column best_before date generated always as (prep_date + shelf_life_days) stored;
alter table public.meals drop column shelf_life_weeks;
create index meals_best_before_idx on public.meals (best_before) where archived_at is null;
