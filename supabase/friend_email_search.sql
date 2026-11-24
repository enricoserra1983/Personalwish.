-- PersonalWish: ricerca tramite username esatto o email esatta.
-- Non restituisce mai l'indirizzo email: mostra soltanto lo username.
-- Eseguire dopo supabase/account_privacy_settings.sql, che crea username e allow_user_search.

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
