-- PersonalWish: mostra a un utente autenticato solo le liste pubbliche di un profilo cercato.
create or replace function public.get_public_wishlists_for_user(p_user_id uuid)
returns table (
  id uuid,
  title text,
  description text,
  share_token text,
  created_at timestamptz,
  image_url text
)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select w.id, w.title, w.description, w.share_token, w.created_at, w.image_url
  from public.wishlists w
  where w.owner_id = p_user_id
    and w.is_public = true
  order by w.created_at desc;
$$;

revoke all on function public.get_public_wishlists_for_user(uuid) from public, anon;
grant execute on function public.get_public_wishlists_for_user(uuid) to authenticated;
