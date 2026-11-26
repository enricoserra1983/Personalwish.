-- MyPersonalWish: accesso alle prenotazioni solo in lettura diretta.
-- Tutte le modifiche passano dalle RPC SECURITY DEFINER con controlli applicativi.

revoke all privileges on table public.reservations from anon, authenticated;
grant select on table public.reservations to authenticated;

-- La funzione set_my_reservation_purchased gestisce già sia il passaggio
-- reserved -> purchased sia l'annullamento (p_purchased = false).
-- Si ribadisce qui il perimetro minimo dei permessi RPC.
revoke all on function public.reserve_shared_wishlist_item(text, uuid) from public, anon;
grant execute on function public.reserve_shared_wishlist_item(text, uuid) to authenticated;

revoke all on function public.set_my_reservation_purchased(text, uuid, boolean) from public, anon;
grant execute on function public.set_my_reservation_purchased(text, uuid, boolean) to authenticated;
