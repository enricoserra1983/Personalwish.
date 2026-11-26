-- MyPersonalWish: accesso privato alle immagini delle wishlist.
-- Eseguire una sola volta nel Supabase SQL Editor.
-- Mantiene l'accesso anonimo SOLO alle immagini delle liste pubbliche.
-- Le vecchie foto profilo restano leggibili solo dal proprietario per consentire
-- la migrazione automatica verso il bucket profile-images.

create or replace function public.can_read_wishlist_image(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage, pg_temp
set row_security = off
as $$
declare
  v_parts text[];
  v_owner_id text;
  v_wishlist_id text;
begin
  v_parts := storage.foldername(object_name);

  if coalesce(array_length(v_parts, 1), 0) < 2 then
    return false;
  end if;

  v_owner_id := v_parts[1];
  v_wishlist_id := v_parts[2];

  -- Migrazione delle vecchie foto profilo: solo il proprietario può leggerle.
  if v_wishlist_id = 'profile' then
    return auth.uid() is not null and v_owner_id = auth.uid()::text;
  end if;

  return exists (
    select 1
    from public.wishlists w
    where w.id::text = v_wishlist_id
      and w.owner_id::text = v_owner_id
      and (
        w.is_public = true
        or auth.uid() = w.owner_id
        or exists (
          select 1 from public.wishlist_members m
          where m.wishlist_id = w.id and m.user_id = auth.uid()
        )
        or (
          w.private_access_mode = 'all_friends'
          and auth.uid() is not null
          and exists (
            select 1 from public.friendships f
            where (f.user_low = auth.uid() and f.user_high = w.owner_id)
               or (f.user_high = auth.uid() and f.user_low = w.owner_id)
          )
        )
      )
  );
end;
$$;

revoke all on function public.can_read_wishlist_image(text) from public;
grant execute on function public.can_read_wishlist_image(text) to anon, authenticated;

drop policy if exists "Wishlist images are publicly viewable" on storage.objects;
drop policy if exists "Wishlist images readable by authorized viewers" on storage.objects;

create policy "Wishlist images readable by authorized viewers"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'wishlist-images'
  and public.can_read_wishlist_image(name)
);

-- Il bucket diventa privato dopo l'attivazione della policy.
update storage.buckets
set public = false
where id = 'wishlist-images';
