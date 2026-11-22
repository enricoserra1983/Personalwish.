-- Correzione: get_shared_wishlist inserisce il partecipante nelle liste private
-- condivise con tutti gli amici. Deve quindi essere VOLATILE, non STABLE.
create or replace function public.get_shared_wishlist(p_share_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_w public.wishlists%rowtype;
  v_items jsonb;
begin
  select * into v_w
  from public.wishlists
  where share_token = p_share_token;

  if not found then
    return null;
  end if;

  if not v_w.is_public
     and auth.uid() is distinct from v_w.owner_id
     and not exists (
       select 1 from public.wishlist_members m
       where m.wishlist_id = v_w.id and m.user_id = auth.uid()
     )
     and not (
       v_w.private_access_mode = 'all_friends'
       and exists (
         select 1 from public.friendships f
         where (f.user_low = auth.uid() and f.user_high = v_w.owner_id)
            or (f.user_high = auth.uid() and f.user_low = v_w.owner_id)
       )
     ) then
    return jsonb_build_object('access_required', true, 'owner_id', v_w.owner_id);
  end if;

  if not v_w.is_public
     and auth.uid() is not null
     and auth.uid() <> v_w.owner_id
     and v_w.private_access_mode = 'all_friends'
     and exists (
       select 1 from public.friendships f
       where (f.user_low = auth.uid() and f.user_high = v_w.owner_id)
          or (f.user_high = auth.uid() and f.user_low = v_w.owner_id)
     ) then
    insert into public.wishlist_members(wishlist_id, user_id, role)
    values (v_w.id, auth.uid(), 'participant')
    on conflict (wishlist_id, user_id) do nothing;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'title', i.title,
        'description', i.description,
        'image_url', i.image_url,
        'product_url', i.product_url,
        'price', i.price,
        'currency', i.currency
      ) order by i.position, i.created_at
    ),
    '[]'::jsonb
  )
  into v_items
  from public.wishlist_items i
  where i.wishlist_id = v_w.id;

  return jsonb_build_object(
    'id', v_w.id,
    'title', v_w.title,
    'description', v_w.description,
    'items', v_items,
    'owner_id', v_w.owner_id,
    'is_public', v_w.is_public
  );
end;
$$;

revoke all on function public.get_shared_wishlist(text) from public;
grant execute on function public.get_shared_wishlist(text) to anon, authenticated;
