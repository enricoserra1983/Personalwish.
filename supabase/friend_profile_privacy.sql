-- PersonalWish: privacy dei profili e della rete di amici.
-- Eseguire una sola volta nel SQL Editor di Supabase.

alter table public.profiles
  add column if not exists profile_details_visible boolean not null default true,
  add column if not exists friend_network_visibility text not null default 'all'
    check (friend_network_visibility in ('all','except','none')),
  add column if not exists allow_indirect_friend_visibility boolean not null default true,
  add column if not exists friend_network_excluded_ids uuid[] not null default '{}'::uuid[];

-- Restituisce il profilo di un amico diretto e, se consentito da entrambe le
-- impostazioni, i suoi amici che hanno autorizzato la visibilità indiretta.
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
      'avatar_url', p.avatar_url
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
    'avatar_url', case when coalesce(v_profile.profile_details_visible, true) then v_profile.avatar_url else null end,
    'first_name', case when coalesce(v_profile.profile_details_visible, true) then v_profile.first_name else null end,
    'last_name', case when coalesce(v_profile.profile_details_visible, true) then v_profile.last_name else null end,
    'birth_date', case when coalesce(v_profile.birthday_visible, false) then v_profile.birth_date else null end,
    'birthday_visible', coalesce(v_profile.birthday_visible, false),
    'friends_visible', v_show_friends,
    'friends', v_friends
  );
end;
$$;

revoke all on function public.get_friend_profile(uuid) from public, anon;
grant execute on function public.get_friend_profile(uuid) to authenticated;
