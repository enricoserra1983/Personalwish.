-- PersonalWish: prenotazione atomica di un desiderio tramite link condiviso.
-- Il chiamante deve essere autenticato. La funzione non restituisce l'identità
-- del prenotante e impedisce più prenotazioni attive dello stesso articolo.

create unique index if not exists reservations_one_active_per_item
  on public.reservations (item_id)
  where status in ('reserved', 'purchased');

create or replace function public.reserve_shared_wishlist_item(
  p_share_token text,
  p_item_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_wishlist_id uuid;
  v_owner_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Devi accedere per prenotare un regalo';
  end if;

  select w.id, w.owner_id
    into v_wishlist_id, v_owner_id
  from public.wishlists w
  join public.wishlist_items i on i.wishlist_id = w.id
  where w.share_token = p_share_token
    and i.id = p_item_id;

  if v_wishlist_id is null then
    raise exception 'Lista o desiderio non trovato';
  end if;

  if v_owner_id = auth.uid() then
    raise exception 'Non puoi prenotare un regalo della tua lista';
  end if;

  insert into public.wishlist_members (wishlist_id, user_id, role)
  values (v_wishlist_id, auth.uid(), 'participant')
  on conflict (wishlist_id, user_id) do nothing;

  begin
    insert into public.reservations (item_id, user_id, status)
    values (p_item_id, auth.uid(), 'reserved');
  exception when unique_violation then
    return false;
  end;

  return true;
end;
$$;

revoke all on function public.reserve_shared_wishlist_item(text, uuid) from public;
grant execute on function public.reserve_shared_wishlist_item(text, uuid) to authenticated;
