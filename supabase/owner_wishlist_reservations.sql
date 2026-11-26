-- MyPersonalWish: owner-only reservation status for the wishlist dashboard.
-- Returns nothing unless the owner enabled reservation visibility.
-- Buyer identity is returned only when owner_sees_buyer is enabled.

create or replace function public.get_owner_wishlist_reservations(p_wishlist_id uuid)
returns table (
  item_id uuid,
  status text,
  buyer_name text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_owner uuid;
  v_can_see_reservations boolean;
  v_can_see_buyer boolean;
begin
  if auth.uid() is null then
    raise exception 'Autenticazione richiesta';
  end if;

  select w.owner_id,
         coalesce(w.owner_sees_reservations, false),
         coalesce(w.owner_sees_buyer, false)
    into v_owner, v_can_see_reservations, v_can_see_buyer
  from public.wishlists w
  where w.id = p_wishlist_id;

  if not found or v_owner <> auth.uid() then
    raise exception 'Non autorizzato';
  end if;

  if not v_can_see_reservations then
    return;
  end if;

  return query
  select r.item_id,
         r.status,
         case when v_can_see_buyer then
           coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(p.username), ''), 'Utente')
         else null end
  from public.reservations r
  join public.wishlist_items i on i.id = r.item_id
  left join public.profiles p on p.id = r.user_id
  where i.wishlist_id = p_wishlist_id
    and r.status in ('reserved','purchased')
  order by r.updated_at desc;
end;
$$;

revoke all on function public.get_owner_wishlist_reservations(uuid) from public, anon;
grant execute on function public.get_owner_wishlist_reservations(uuid) to authenticated;
