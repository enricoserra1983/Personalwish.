-- PersonalWish: chiude le notifiche di richiesta quando la richiesta viene gestita
-- dalla schermata Amici (o dal Centro notifiche).
-- Allinea anche le notifiche di richieste già accettate o rifiutate in passato.
update public.notifications n
set title = case
      when r.status = 'accepted' then 'Amicizia confermata'
      else 'Richiesta rifiutata'
    end,
    body = case
      when r.status = 'accepted'
        then 'Hai accettato la richiesta di amicizia di ' || coalesce(p.display_name, 'questo utente') || '.'
      else 'Hai rifiutato la richiesta di amicizia di ' || coalesce(p.display_name, 'questo utente') || '.'
    end,
    read_at = coalesce(n.read_at, now()),
    friend_request_id = null
from public.friend_requests r
left join public.profiles p on p.id = r.requester_id
where n.friend_request_id = r.id
  and n.user_id = r.recipient_id
  and r.status in ('accepted', 'rejected');

create or replace function public.resolve_friend_request_notification()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_requester_name text;
begin
  if old.status is distinct from new.status
     and new.status in ('accepted', 'rejected') then
    select coalesce(display_name, 'L’utente')
      into v_requester_name
    from public.profiles
    where id = new.requester_id;

    update public.notifications
    set title = case
          when new.status = 'accepted' then 'Amicizia confermata'
          else 'Richiesta rifiutata'
        end,
        body = case
          when new.status = 'accepted'
            then 'Hai accettato la richiesta di amicizia di ' || coalesce(v_requester_name, 'questo utente') || '.'
          else 'Hai rifiutato la richiesta di amicizia di ' || coalesce(v_requester_name, 'questo utente') || '.'
        end,
        read_at = coalesce(read_at, now()),
        friend_request_id = null
    where friend_request_id = new.id
      and user_id = new.recipient_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_resolve_friend_request_notification on public.friend_requests;
create trigger trg_resolve_friend_request_notification
after update of status on public.friend_requests
for each row
execute function public.resolve_friend_request_notification();

revoke all on function public.resolve_friend_request_notification() from public;

NOTIFY pgrst, 'reload schema';
