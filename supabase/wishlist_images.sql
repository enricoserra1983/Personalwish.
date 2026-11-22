-- Immagine personalizzata per ogni lista PersonalWish
alter table public.wishlists
  add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wishlist-images', 'wishlist-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

drop policy if exists "Wishlist images are publicly viewable" on storage.objects;
create policy "Wishlist images are publicly viewable"
on storage.objects for select
using (bucket_id = 'wishlist-images');

drop policy if exists "Users upload their own wishlist images" on storage.objects;
create policy "Users upload their own wishlist images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'wishlist-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users update their own wishlist images" on storage.objects;
create policy "Users update their own wishlist images"
on storage.objects for update to authenticated
using (
  bucket_id = 'wishlist-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'wishlist-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users delete their own wishlist images" on storage.objects;
create policy "Users delete their own wishlist images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'wishlist-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);
