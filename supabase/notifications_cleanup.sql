-- Completa le notifiche di richieste già create prima dell'aggiunta del pulsante.
update public.notifications n
set friend_request_id = r.id
from public.friend_requests r
where n.type = 'friend_request'
  and n.friend_request_id is null
  and n.user_id = r.recipient_id
  and n.actor_id = r.requester_id
  and r.status = 'pending'
  and n.created_at between r.created_at - interval '2 minutes' and r.created_at + interval '2 minutes';

create or replace function public.delete_my_notification(p_notification_id uuid)
returns void
language sql security definer set search_path=public set row_security=off
as $$
  delete from public.notifications
  where id = p_notification_id and user_id = auth.uid();
$$;
revoke all on function public.delete_my_notification(uuid) from public;
grant execute on function public.delete_my_notification(uuid) to authenticated;
