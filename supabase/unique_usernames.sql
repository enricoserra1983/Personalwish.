-- PersonalWish: username univoci e rinomina del primo account.
-- Eseguire una sola volta nel SQL Editor di Supabase.

-- 1) Rinomina il profilo associato all'email indicata dall'utente.
update auth.users
set raw_user_meta_data = jsonb_set(coalesce(raw_user_meta_data, '{}'::jsonb), '{display_name}', '"Enrico83"'::jsonb, true)
where lower(email) = lower('bladerunner83@tiscali.it');

update public.profiles p
set display_name = 'Enrico83'
from auth.users u
where u.id = p.id
  and lower(u.email) = lower('bladerunner83@tiscali.it');

-- 2) Impedisce nomi utente duplicati, ignorando maiuscole/minuscole e spazi esterni.
create unique index if not exists profiles_display_name_unique
on public.profiles (lower(btrim(display_name)))
where display_name is not null and btrim(display_name) <> '';

-- 3) Controllo utilizzabile durante la registrazione.
create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select length(btrim(coalesce(p_username, ''))) between 3 and 30
     and btrim(p_username) ~ '^[A-Za-z0-9_]+$'
     and not exists (
       select 1
       from public.profiles p
       where lower(btrim(p.display_name)) = lower(btrim(p_username))
     );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;
