-- Atomic consume/undo: replaces the client-side read-modify-write eat flow.
-- SECURITY INVOKER so RLS on meals/meal_log keeps applying inside the functions.

alter table public.meal_log
  add column caused_depletion boolean not null default false;

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

  select * into v_meal from public.meals where id = p_meal_id for update;
  if not found then
    raise exception 'meal not found';
  end if;

  v_new_qty := greatest(v_meal.pack_quantity - p_packs, 0);
  v_depleted := v_new_qty = 0 and v_meal.pack_quantity > 0;

  update public.meals
     set pack_quantity = v_new_qty,
         archived_at = case when v_new_qty = 0 then coalesce(archived_at, now()) else archived_at end,
         updated_at = now()
   where id = p_meal_id;

  insert into public.meal_log (meal_id, packs, caused_depletion)
       values (p_meal_id, least(p_packs, greatest(v_meal.pack_quantity, 1)), v_depleted)
    returning id into v_log_id;

  return jsonb_build_object('log_id', v_log_id, 'new_qty', v_new_qty, 'depleted', v_depleted);
end
$$;

create or replace function public.undo_eat(p_log_id uuid)
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

  update public.meals
     set pack_quantity = pack_quantity + v_log.packs,
         archived_at = case when v_log.caused_depletion then null else archived_at end,
         updated_at = now()
   where id = v_log.meal_id;

  return jsonb_build_object('meal_id', v_log.meal_id);
end
$$;

revoke all on function public.eat_pack(uuid, int) from public, anon;
revoke all on function public.undo_eat(uuid) from public, anon;
grant execute on function public.eat_pack(uuid, int) to authenticated;
grant execute on function public.undo_eat(uuid) to authenticated;
