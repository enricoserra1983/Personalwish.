-- PersonalWish: accesso alle liste tramite link condiviso.
-- Restituisce solo dati della lista e dei desideri: mai partecipanti o prenotazioni.

create or replace function public.get_shared_wishlist(p_share_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select jsonb_build_object(
    'id', w.id,
    'title', w.title,
    'description', w.description,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'title', i.title,
          'description', i.description,
          'image_url', i.image_url,
          'product_url', i.product_url,
          'price', i.price,
          'currency', i.currency
        ) order by i.position, i.created_at
      )
      from public.wishlist_items i
      where i.wishlist_id = w.id
    ), '[]'::jsonb)
  )
  from public.wishlists w
  where w.share_token = p_share_token
  limit 1;
$$;

revoke all on function public.get_shared_wishlist(text) from public;
grant execute on function public.get_shared_wishlist(text) to anon, authenticated;
