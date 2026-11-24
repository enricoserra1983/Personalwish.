-- PersonalWish: username separato dal nome visualizzato e preferenze privacy.
-- Eseguire una sola volta nel SQL Editor di Supabase.

alter table public.profiles
  add column if not exists username text,
  add column if not exists allow_user_search boolean not null default true,
  add column if not exists allow_friend_requests boolean not null default true,
  add column if not exists notify_friend_requests boolean not null default true,
  add column if not exists notify_list_activity boolean not null default true;

-- Conserva come username il nome utente attualmente presente nel profilo.
update public.profiles
set username = nullif(btrim(display_name), '')
where username is null;

create unique index if not exists profiles_username_unique
  on public.profiles (lower(btrim(username)))
  where username is not null and btrim(username) <> '';

alter table public.profiles alter column username set not null;

-- I nuovi account ricevono username dal campo scelto in registrazione.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  v_username := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Utente'
  );

  insert into public.profiles (id, display_name, username)
  values (new.id, v_username, v_username)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Verifica la disponibilità sul campo username dedicato.
create or replace function public.is_username_available(p_username text)
returns boolean
language sql stable security definer
set search_path = public
set row_security = off
as $$
  select length(btrim(coalesce(p_username, ''))) between 3 and 30
     and btrim(p_username) ~ '^[A-Za-z0-9]+(?: [A-Za-z0-9]+)*$'
     and not exists (
       select 1 from public.profiles p
       where lower(btrim(p.username)) = lower(btrim(p_username))
     );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

-- Ricerca per username esatto oppure email esatta. Non restituisce mai email.
drop function if exists public.search_personalwish_users(text);
create function public.search_personalwish_users(p_term text)
returns table (user_id uuid, display_name text)
language sql stable security definer
set search_path = public, auth
set row_security = off
as $$
  select p.id, p.username as display_name
  from public.profiles p
  join auth.users u on u.id = p.id
  where auth.uid() is not null
    and p.id <> auth.uid()
    and coalesce(p.allow_user_search, true)
    and length(trim(coalesce(p_term,''))) >= 3
    and (
      lower(btrim(coalesce(p.username,''))) = lower(btrim(p_term))
      or lower(coalesce(u.email,'')) = lower(btrim(p_term))
    )
  order by case when lower(coalesce(u.email,'')) = lower(btrim(p_term)) then 0 else 1 end
  limit 1;
$$;
revoke all on function public.search_personalwish_users(text) from public;
grant execute on function public.search_personalwish_users(text) to authenticated;

-- Impedisce richieste di amicizia se il destinatario le ha disattivate.
create or replace function public.enforce_friend_request_preference()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if not coalesce((select allow_friend_requests from public.profiles where id = new.recipient_id), true) then
    raise exception 'Questo utente non accetta richieste di amicizia.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_friend_request_preference on public.friend_requests;
create trigger trg_enforce_friend_request_preference
before insert on public.friend_requests
for each row execute function public.enforce_friend_request_preference();

-- Rispetta le preferenze prima di creare notifiche.
create or replace function public.apply_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_friend boolean;
  v_activity boolean;
begin
  select coalesce(notify_friend_requests, true), coalesce(notify_list_activity, true)
    into v_friend, v_activity
  from public.profiles where id = new.user_id;

  if new.type in ('friend_request','friend_accepted') and not coalesce(v_friend, true) then
    return null;
  end if;
  if new.type in ('list_participant','item_reserved','item_purchased','wishlist_updated')
     and not coalesce(v_activity, true) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_apply_notification_preferences on public.notifications;
create trigger trg_apply_notification_preferences
before insert on public.notifications
for each row execute function public.apply_notification_preferences();
