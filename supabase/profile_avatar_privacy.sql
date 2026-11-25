-- PersonalWish: visibilità indipendente e archiviazione privata delle foto profilo.
-- Preparazione migration: NON eseguire finché non è pronta anche la migrazione
-- delle foto esistenti e l'aggiornamento del client.
--
-- I valori ammessi sono:
-- all                 = tutti, anche utenti non autenticati
-- friends             = solo amici diretti
-- friends_of_friends  = amici diretti e persone con almeno un amico in comune
-- none                = solo il proprietario

alter table public.profiles
  add column if not exists profile_avatar_visibility text not null default 'all';

alter table public.profiles
  drop constraint if exists profiles_profile_avatar_visibility_check;

alter table public.profiles
  add constraint profiles_profile_avatar_visibility_check
  check (profile_avatar_visibility in ('all','friends','friends_of_friends','none'));

-- Bucket separato: wishlist-images resta pubblico per le immagini dei desideri
-- e delle liste; le nuove foto profilo vengono salvate qui.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-images',
  'profile-images',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

-- Funzione unica usata sia dalle policy Storage sia dalle RPC del profilo.
-- Il parametro è l'ID del proprietario della foto, non il percorso del file.
create or replace function public.can_view_profile_avatar(p_profile_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_visibility text;
  v_viewer uuid := auth.uid();
begin
  if p_profile_id is null then
    return false;
  end if;

  if v_viewer = p_profile_id then
    return true;
  end if;

  select p.profile_avatar_visibility
    into v_visibility
  from public.profiles p
  where p.id = p_profile_id;

  if not found then
    return false;
  end if;

  if v_visibility = 'all' then
    return true;
  end if;

  if v_viewer is null or v_visibility = 'none' then
    return false;
  end if;

  if v_visibility = 'friends' then
    return exists (
      select 1
      from public.friendships f
      where (f.user_low = v_viewer and f.user_high = p_profile_id)
         or (f.user_high = v_viewer and f.user_low = p_profile_id)
    );
  end if;

  if v_visibility = 'friends_of_friends' then
    if exists (
      select 1 from public.friendships f
      where (f.user_low = v_viewer and f.user_high = p_profile_id)
         or (f.user_high = v_viewer and f.user_low = p_profile_id)
    ) then
      return true;
    end if;

    return exists (
      select 1
      from public.friendships viewer_edge
      join public.friendships owner_edge
        on (
          case
            when owner_edge.user_low = p_profile_id then owner_edge.user_high
            else owner_edge.user_low
          end
        ) = (
          case
            when viewer_edge.user_low = v_viewer then viewer_edge.user_high
            else viewer_edge.user_low
          end
        )
      where (
        viewer_edge.user_low = v_viewer
        or viewer_edge.user_high = v_viewer
      )
      and (
        owner_edge.user_low = p_profile_id
        or owner_edge.user_high = p_profile_id
      )
      and (
        case
          when viewer_edge.user_low = v_viewer then viewer_edge.user_high
          else viewer_edge.user_low
        end
      ) <> p_profile_id
      and (
        case
          when viewer_edge.user_low = v_viewer then viewer_edge.user_high
          else viewer_edge.user_low
        end
      ) <> v_viewer
    );
  end if;;

  return false;
end;
$$;

revoke all on function public.can_view_profile_avatar(uuid) from public;
grant execute on function public.can_view_profile_avatar(uuid) to anon, authenticated;

-- Ogni file deve essere collocato in una cartella il cui primo livello è
-- l'UUID del proprietario: <user-uuid>/profile/<filename>.
drop policy if exists "Profile images visibility follows profile privacy" on storage.objects;
create policy "Profile images visibility follows profile privacy"
on storage.objects for select
to anon, authenticated
using (
  bucket_id = 'profile-images'
  and public.can_view_profile_avatar(
    nullif((storage.foldername(name))[1], '')::uuid
  )
);

drop policy if exists "Users upload their own profile images" on storage.objects;
create policy "Users upload their own profile images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users update their own profile images" on storage.objects;
create policy "Users update their own profile images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users delete their own profile images" on storage.objects;
create policy "Users delete their own profile images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);
