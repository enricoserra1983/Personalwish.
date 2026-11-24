-- PersonalWish: limita l'aggiornamento delle notifiche al solo campo read_at.
-- La policy RLS continua a consentire modifiche esclusivamente alle notifiche proprie.

revoke update on table public.notifications from authenticated;
grant update (read_at) on table public.notifications to authenticated;
