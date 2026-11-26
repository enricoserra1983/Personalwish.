-- MyPersonalWish: consente a ciascun utente di recuperare solo i nomi
-- dei proprietari delle wishlist da cui ha prenotato/acquistato almeno un prodotto.
create or replace function public.get_my_reservation_list_owners()
returns table (owner_id uuid, display_name text)
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select distinct
    w.owner_id,
    coalesce(nullif(btrim(p.display_name), ''), 'Utente') as display_name
  from public.reservations r
  join public.wishlist_items i on i.id = r.item_id
  join public.wishlists w on w.id = i.wishlist_id
  join public.profiles p on p.id = w.owner_id
  where r.user_id = auth.uid()
    and r.status in ('reserved', 'purchased')
    and auth.uid() is not null;
$$;

revoke all on function public.get_my_reservation_list_owners() from public, anon;
grant execute on function public.get_my_reservation_list_owners() to authenticated;
