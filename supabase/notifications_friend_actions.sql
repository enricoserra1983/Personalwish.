-- Collega le notifiche di richiesta amicizia alla richiesta originale,
-- così l'utente può accettare o rifiutare direttamente dal Centro notifiche.
alter table public.notifications
  add column if not exists friend_request_id uuid references public.friend_requests(id) on delete cascade;

create or replace function public.notify_friend_request()
returns trigger language plpgsql security definer set search_path=public set row_security=off as $$
declare v_name text;
begin
 select display_name into v_name from public.profiles where id=new.requester_id;
 insert into public.notifications(user_id,actor_id,type,title,body,wishlist_id,friend_request_id)
 values(new.recipient_id,new.requester_id,'friend_request','Nuova richiesta di amicizia',
        coalesce(v_name,'Un utente')||' ti ha inviato una richiesta di amicizia.',new.wishlist_id,new.id);
 return new;
end; $$;

drop function if exists public.get_my_notifications(integer);
create function public.get_my_notifications(p_limit integer default 50)
returns table(id uuid, type text, title text, body text, wishlist_id uuid, item_id uuid,
              actor_name text, created_at timestamptz, read_at timestamptz, friend_request_id uuid)
language sql stable security definer set search_path=public set row_security=off
as $$
 select n.id,n.type,n.title,n.body,n.wishlist_id,n.item_id,
        coalesce(p.display_name,'Un utente'),n.created_at,n.read_at,n.friend_request_id
 from public.notifications n
 left join public.profiles p on p.id=n.actor_id
 where n.user_id=auth.uid()
 order by n.created_at desc
 limit greatest(1,least(coalesce(p_limit,50),100));
$$;

revoke all on function public.get_my_notifications(integer) from public;
grant execute on function public.get_my_notifications(integer) to authenticated;
