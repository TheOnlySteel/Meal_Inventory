-- Inventory integrity: eat_pack must reject archived/zero-stock meals and log
-- exactly what was consumed. The 004 version clamped stock to zero but still
-- logged >= 1 pack, so undo_eat could credit back a pack that was never eaten
-- and drift inventory upward. complete_plan_entry (007) calls eat_pack, so it
-- picks up the same guards; its exception propagates to the client unchanged.
--
-- Custom SQLSTATEs surfaced to clients as error.code:
--   MI001 = meal is archived
--   MI002 = insufficient stock

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

  -- Row lock held through the checks below, so two devices racing for the
  -- last pack serialize here and the loser gets MI002.
  select * into v_meal from public.meals where id = p_meal_id for update;
  if not found then
    raise exception 'meal not found';
  end if;
  if v_meal.archived_at is not null then
    raise exception 'meal is archived' using errcode = 'MI001';
  end if;
  if v_meal.pack_quantity < p_packs then
    raise exception 'insufficient stock: % pack(s) left', v_meal.pack_quantity
      using errcode = 'MI002';
  end if;

  v_new_qty := v_meal.pack_quantity - p_packs;
  v_depleted := v_new_qty = 0;

  update public.meals
     set pack_quantity = v_new_qty,
         archived_at = case when v_depleted then now() else archived_at end,
         updated_at = now()
   where id = p_meal_id;

  -- Log exactly what was consumed; undo_eat (002) credits this back 1:1.
  insert into public.meal_log (meal_id, packs, caused_depletion, household_id)
       values (p_meal_id, p_packs, v_depleted, v_meal.household_id)
    returning id into v_log_id;

  return jsonb_build_object('log_id', v_log_id, 'new_qty', v_new_qty, 'depleted', v_depleted);
end
$$;

-- meal_log hardening -----------------------------------------------------------

-- Open grants allowed arbitrary direct inserts; clear any nonsense rows before
-- constraining (plan_entries.log_id is ON DELETE SET NULL, so this is safe).
delete from public.meal_log where packs <= 0;
alter table public.meal_log
  add constraint meal_log_packs_positive check (packs > 0);

-- Nothing updates log rows: eat_pack/undo_eat only INSERT/DELETE (as invoker,
-- so their INSERT/DELETE grants must stay).
drop policy "member update log" on public.meal_log;
revoke update on table public.meal_log from authenticated;

-- Log rows must be attributed to the caller. eat_pack omits user_id, so the
-- column default auth.uid() (001) is applied before WITH CHECK is evaluated.
drop policy "member insert log" on public.meal_log;
create policy "member insert log" on public.meal_log
  for insert to authenticated
  with check (public.is_household_member(household_id) and user_id = auth.uid());

-- Meal deletion vs plan history --------------------------------------------------

-- plan_entries.meal_id is ON DELETE SET NULL, but 007's check constraint needs
-- meal_id OR a nonblank title, and meal-linked entries have no title — so
-- deleting a planned meal used to fail. Snapshot the name into the title first;
-- BEFORE DELETE row triggers run ahead of the FK's referential action.
-- (meals -> meal_log stays ON DELETE CASCADE: the log only powers same-day
-- undo today, and losing it with the meal is accepted for now.)
create or replace function public.snapshot_meal_title_into_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.plan_entries
     set title = old.name
   where meal_id = old.id
     and (title is null or length(trim(title)) = 0);
  return old;
end
$$;

-- Trigger functions must not be callable via PostgREST RPC (matches 005).
revoke all on function public.snapshot_meal_title_into_plan() from public, anon, authenticated;

create trigger meals_snapshot_plan_titles
  before delete on public.meals
  for each row execute function public.snapshot_meal_title_into_plan();
