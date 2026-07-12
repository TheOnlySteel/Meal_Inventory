-- Stock events: meal_log grows a kind so restocks and tossed packs are
-- first-class events alongside consumption. adjust_stock handles the new
-- kinds with the same locking/guard discipline as eat_pack (011), and
-- undo_stock_event reverses any kind (superseding undo_eat, which stays for
-- clients deployed before this migration).

alter table public.meal_log
  add column kind text not null default 'consume'
    check (kind in ('consume', 'restock', 'waste'));

create index meal_log_kind_logged_idx on public.meal_log (household_id, kind, logged_at);

create or replace function public.adjust_stock(p_meal_id uuid, p_packs int, p_kind text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_meal public.meals%rowtype;
  v_new_qty int;
  v_depleted boolean := false;
  v_log_id uuid;
begin
  if p_packs < 1 then
    raise exception 'packs must be positive';
  end if;
  if p_kind not in ('restock', 'waste') then
    raise exception 'kind must be restock or waste';
  end if;

  select * into v_meal from public.meals where id = p_meal_id for update;
  if not found then
    raise exception 'meal not found';
  end if;

  if p_kind = 'restock' then
    -- Restocking an archived meal revives it.
    v_new_qty := v_meal.pack_quantity + p_packs;
    update public.meals
       set pack_quantity = v_new_qty,
           initial_pack_quantity = greatest(initial_pack_quantity, v_new_qty),
           archived_at = null,
           updated_at = now()
     where id = p_meal_id;
  else
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
  end if;

  insert into public.meal_log (meal_id, packs, kind, caused_depletion, household_id)
       values (p_meal_id, p_packs, p_kind, v_depleted, v_meal.household_id)
    returning id into v_log_id;

  return jsonb_build_object('log_id', v_log_id, 'new_qty', v_new_qty, 'depleted', v_depleted);
end
$$;

revoke all on function public.adjust_stock(uuid, int, text) from public, anon;
grant execute on function public.adjust_stock(uuid, int, text) to authenticated;

create or replace function public.undo_stock_event(p_log_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_log public.meal_log%rowtype;
begin
  delete from public.meal_log where id = p_log_id returning * into v_log;
  if not found then
    raise exception 'log entry not found';
  end if;

  if v_log.kind = 'restock' then
    -- Taking the restocked packs back out; archive if that empties the meal.
    update public.meals
       set pack_quantity = greatest(pack_quantity - v_log.packs, 0),
           archived_at = case
             when pack_quantity - v_log.packs <= 0 then coalesce(archived_at, now())
             else archived_at
           end,
           updated_at = now()
     where id = v_log.meal_id;
  else
    -- consume/waste: credit the packs back, reviving if the event archived it.
    update public.meals
       set pack_quantity = pack_quantity + v_log.packs,
           archived_at = case when v_log.caused_depletion then null else archived_at end,
           updated_at = now()
     where id = v_log.meal_id;
  end if;

  return jsonb_build_object('meal_id', v_log.meal_id, 'kind', v_log.kind);
end
$$;

revoke all on function public.undo_stock_event(uuid) from public, anon;
grant execute on function public.undo_stock_event(uuid) to authenticated;
