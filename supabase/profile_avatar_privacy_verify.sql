-- PersonalWish: controlli post-attivazione privacy avatar.
-- Eseguire DOPO profile_avatar_privacy.sql, dal SQL Editor Supabase.
-- Non modifica dati.

-- 1) Quanti profili hanno ancora un vecchio URL pubblico nel bucket condiviso?
select
  count(*) filter (where avatar_url like '%/storage/v1/object/public/wishlist-images/%') as avatar_ancora_pubblici,
  count(*) filter (where avatar_url is not null and avatar_url not like 'http%') as avatar_con_percorso_privato,
  count(*) filter (where avatar_url is null) as profili_senza_avatar
from public.profiles;

-- 2) Verifica che il bucket dedicato esista e sia privato.
select id, name, public, file_size_limit
from storage.buckets
where id in ('profile-images', 'wishlist-images')
order by id;

-- 3) Verifica le policy attive sul bucket privato.
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname ilike '%profile image%'
order by policyname;

-- 4) Verifica la funzione di autorizzazione.
select
  p.id,
  p.profile_avatar_visibility,
  public.can_view_profile_avatar(p.id) as viewer_corrente_puo_vedere
from public.profiles p
where p.id = auth.uid();
