drop function if exists public.search_personalwish_users(text);

-- PersonalWish: ricerca amici tramite nome utente esatto o email esatta.
-- La ricerca email è disponibile solo agli utenti autenticati.
create or replace function public.search_personalwish_users(p_term text)
returns table (user_id uuid, display_name text, email text)
language sql stable security definer
set search_path = public, auth
set row_security = off
as $$
  select p.id,
         coalesce(nullif(p.display_name,''), split_part(u.email,'@',1)) as display_name,
         u.email::text as email
  from public.profiles p
  join auth.users u on u.id = p.id
  where auth.uid() is not null
    and p.id <> auth.uid()
    and length(trim(coalesce(p_term,''))) >= 2
    and (
      lower(btrim(coalesce(p.display_name,''))) = lower(btrim(p_term))
      or lower(coalesce(u.email,'')) = lower(btrim(p_term))
    )
  order by
    case when lower(u.email) = lower(trim(p_term)) then 0 else 1 end,
    p.display_name
  limit 15;
$$;

revoke all on function public.search_personalwish_users(text) from public;
grant execute on function public.search_personalwish_users(text) to authenticated;
