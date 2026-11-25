-- PersonalWish: visibilità indipendente e archiviazione privata delle foto profilo.
-- Eseguire solo dopo aver verificato il rilascio del client aggiornato.
-- Valori: all, friends, friends_of_friends, none.

alter table public.profiles
  add column if not exists profile_avatar_visibility text not null default 'all';

alter table public.profiles
  drop constraint if exists profiles_profile_avatar_visibility_check;

alter table public.profiles
  add constraint profiles_profile_avatar_visibility_check
  check (profile_avatar_visibility in ('all','friends','friends_of_friends','none'));

-- Le immagini delle wishlist restano nel bucket pubblico wishlist-images.
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
      select 1
      from public.friendships f
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
          case when owner_edge.user_low = p_profile_id
            then owner_edge.user_high else owner_edge.user_low end
        ) = (
          case when viewer_edge.user_low = v_viewer
            then viewer_edge.user_high else viewer_edge.user_low end
        )
      where (viewer_edge.user_low = v_viewer or viewer_edge.user_high = v_viewer)
        and (owner_edge.user_low = p_profile_id or owner_edge.user_high = p_profile_id)
    );
  end if;

  return false;
end;
$$;

revoke all on function public.can_view_profile_avatar(uuid) from public;
grant execute on function public.can_view_profile_avatar(uuid) to anon, authenticated;

-- La cartella principale del file deve essere l'UUID del proprietario.
drop policy if exists "Profile images visibility follows profile privacy" on storage.objects;
create policy "Profile images visibility follows profile privacy"
on storage.objects for select
to anon, authenticated
using (
  bucket_id = 'profile-images'
  and public.can_view_profile_avatar(
    case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (storage.foldername(name))[1]::uuid
      else null
    end
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

-- RPC del profilo: restituisce il percorso avatar solo quando il viewer è autorizzato.
create or replace function public.get_friend_profile(p_friend_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_profile public.profiles%rowtype;
  v_friends jsonb := '[]'::jsonb;
  v_show_friends boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Devi accedere per visualizzare un profilo';
  end if;

  if p_friend_id = auth.uid() or not exists (
    select 1 from public.friendships f
    where (f.user_low = auth.uid() and f.user_high = p_friend_id)
       or (f.user_high = auth.uid() and f.user_low = p_friend_id)
  ) then
    raise exception 'Questo profilo non è disponibile';
  end if;

  select * into v_profile
  from public.profiles p
  where p.id = p_friend_id;

  if not found then
    raise exception 'Profilo non trovato';
  end if;

  v_show_friends := v_profile.friend_network_visibility <> 'none';

  if v_show_friends then
    select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', p.id,
      'display_name', p.display_name,
      'avatar_url', case
        when public.can_view_profile_avatar(p.id)
         and p.avatar_url is not null
         and p.avatar_url not like 'http%'
        then p.avatar_url else null end
    ) order by p.display_name), '[]'::jsonb)
    into v_friends
    from public.friendships f
    join public.profiles p
      on p.id = case
        when f.user_low = p_friend_id then f.user_high
        else f.user_low
      end
    where (f.user_low = p_friend_id or f.user_high = p_friend_id)
      and p.id <> auth.uid()
      and coalesce(p.allow_indirect_friend_visibility, true)
      and (
        v_profile.friend_network_visibility = 'all'
        or (
          v_profile.friend_network_visibility = 'except'
          and not (p.id = any(coalesce(v_profile.friend_network_excluded_ids, '{}'::uuid[])))
        )
      );
  end if;

  return jsonb_build_object(
    'user_id', v_profile.id,
    'display_name', v_profile.display_name,
    'avatar_url', case
      when public.can_view_profile_avatar(v_profile.id)
       and v_profile.avatar_url is not null
       and v_profile.avatar_url not like 'http%'
      then v_profile.avatar_url else null end,
    'first_name', case when coalesce(v_profile.profile_details_visible, true) then v_profile.first_name else null end,
    'last_name', case when coalesce(v_profile.profile_details_visible, true) then v_profile.last_name else null end,
    'city', case when coalesce(v_profile.profile_details_visible, true) then v_profile.city else null end,
    'birth_date', case when coalesce(v_profile.birthday_visible, false) then v_profile.birth_date else null end,
    'birthday_visible', coalesce(v_profile.birthday_visible, false),
    'friends_visible', v_show_friends,
    'friends', v_friends
  );
end;
$$;

revoke all on function public.get_friend_profile(uuid) from public, anon;
grant execute on function public.get_friend_profile(uuid) to authenticated;
