-- Recipes v2: photos and tags, plus a public storage bucket for recipe
-- photos. Paths are namespaced by household id and policies allow only
-- members to write inside their household's folder; reads are public-URL
-- (unguessable uuid paths) so <img> tags need no signing.

alter table public.recipes
  add column photo_path text,
  add column tags text[] not null default '{}';

insert into storage.buckets (id, name, public)
values ('recipe-photos', 'recipe-photos', true)
on conflict (id) do nothing;

create policy "member upload recipe photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'recipe-photos'
    and public.is_household_member((storage.foldername(name))[1]::uuid)
  );

create policy "member update recipe photos" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'recipe-photos'
    and public.is_household_member((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'recipe-photos'
    and public.is_household_member((storage.foldername(name))[1]::uuid)
  );

create policy "member delete recipe photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'recipe-photos'
    and public.is_household_member((storage.foldername(name))[1]::uuid)
  );
