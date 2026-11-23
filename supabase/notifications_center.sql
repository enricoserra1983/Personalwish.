-- PersonalWish: centro notifiche unificato (senza dipendenza dalle chat).
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in ('friend_request','friend_accepted','list_participant','item_reserved','item_purchased','wishlist_updated')),
  title text not null,
  body text,
  wishlist_id uuid references public.wishlists(id) on delete cascade,
  item_id uuid references public.wishlist_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select, update on public.notifications to authenticated;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = auth.uid());
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.get_my_notifications(p_limit integer default 50)
returns table(id uuid, type text, title text, body text, wishlist_id uuid, item_id uuid, actor_name text, created_at timestamptz, read_at timestamptz)
language sql stable security definer set search_path=public set row_security=off
as $$
 select n.id,n.type,n.title,n.body,n.wishlist_id,n.item_id,
        coalesce(p.display_name,'Un utente'),n.created_at,n.read_at
 from public.notifications n
 left join public.profiles p on p.id=n.actor_id
 where n.user_id=auth.uid()
 order by n.created_at desc
 limit greatest(1,least(coalesce(p_limit,50),100));
$$;

create or replace function public.mark_my_notifications_read(p_notification_id uuid default null)
returns integer
language plpgsql security definer set search_path=public set row_security=off
as $$
declare v_count integer;
begin
 update public.notifications set read_at=now()
 where user_id=auth.uid() and read_at is null
   and (p_notification_id is null or id=p_notification_id);
 get diagnostics v_count = row_count;
 return v_count;
end;
$$;

create or replace function public.notify_friend_request()
returns trigger language plpgsql security definer set search_path=public set row_security=off as $$
declare v_name text;
begin
 select display_name into v_name from public.profiles where id=new.requester_id;
 insert into public.notifications(user_id,actor_id,type,title,body,wishlist_id)
 values(new.recipient_id,new.requester_id,'friend_request','Nuova richiesta di amicizia',
        coalesce(v_name,'Un utente')||' ti ha inviato una richiesta di amicizia.',new.wishlist_id);
 return new;
end; $$;

drop trigger if exists trg_notify_friend_request on public.friend_requests;
create trigger trg_notify_friend_request after insert on public.friend_requests
for each row execute function public.notify_friend_request();

create or replace function public.notify_friend_accepted()
returns trigger language plpgsql security definer set search_path=public set row_security=off as $$
declare v_name text;
begin
 if old.status is distinct from new.status and new.status='accepted' then
   select display_name into v_name from public.profiles where id=new.recipient_id;
   insert into public.notifications(user_id,actor_id,type,title,body,wishlist_id)
   values(new.requester_id,new.recipient_id,'friend_accepted','Richiesta di amicizia accettata',
          coalesce(v_name,'Un utente')||' ha accettato la tua richiesta.',new.wishlist_id);
 end if;
 return new;
end; $$;

drop trigger if exists trg_notify_friend_accepted on public.friend_requests;
create trigger trg_notify_friend_accepted after update on public.friend_requests
for each row execute function public.notify_friend_accepted();

create or replace function public.notify_list_participant()
returns trigger language plpgsql security definer set search_path=public set row_security=off as $$
declare v_owner uuid; v_title text; v_name text;
begin
 select owner_id,title into v_owner,v_title from public.wishlists where id=new.wishlist_id;
 if v_owner is not null and v_owner<>new.user_id then
   select display_name into v_name from public.profiles where id=new.user_id;
   insert into public.notifications(user_id,actor_id,type,title,body,wishlist_id)
   values(v_owner,new.user_id,'list_participant','Nuovo partecipante alla lista',
          coalesce(v_name,'Un utente')||' partecipa alla lista "'||v_title||'".',new.wishlist_id);
 end if;
 return new;
end; $$;

drop trigger if exists trg_notify_list_participant on public.wishlist_members;
create trigger trg_notify_list_participant after insert on public.wishlist_members
for each row execute function public.notify_list_participant();

create or replace function public.notify_reservation_event()
returns trigger language plpgsql security definer set search_path=public set row_security=off as $$
declare v_owner uuid; v_list uuid; v_title text; v_name text; v_type text; v_heading text;
begin
 if tg_op='INSERT' then
   if new.status not in ('reserved','purchased') then return new; end if;
   v_type:=case when new.status='purchased' then 'item_purchased' else 'item_reserved' end;
 else
   if old.status=new.status or new.status not in ('reserved','purchased') then return new; end if;
   v_type:=case when new.status='purchased' then 'item_purchased' else 'item_reserved' end;
 end if;
 select w.owner_id,w.id,i.title into v_owner,v_list,v_title
 from public.wishlist_items i join public.wishlists w on w.id=i.wishlist_id
 where i.id=new.item_id;
 if v_owner is null or v_owner=new.user_id then return new; end if;
 select display_name into v_name from public.profiles where id=new.user_id;
 v_heading:=case when v_type='item_purchased' then 'Regalo acquistato' else 'Desiderio prenotato' end;
 insert into public.notifications(user_id,actor_id,type,title,body,wishlist_id,item_id)
 values(v_owner,new.user_id,v_type,v_heading,coalesce(v_name,'Un utente')||
        case when v_type='item_purchased' then ' ha acquistato "' else ' ha prenotato "' end||
        v_title||'".',v_list,new.item_id);
 return new;
end; $$;

drop trigger if exists trg_notify_reservation_insert on public.reservations;
create trigger trg_notify_reservation_insert after insert on public.reservations
for each row execute function public.notify_reservation_event();
drop trigger if exists trg_notify_reservation_update on public.reservations;
create trigger trg_notify_reservation_update after update of status on public.reservations
for each row execute function public.notify_reservation_event();

revoke all on function public.get_my_notifications(integer) from public;
revoke all on function public.mark_my_notifications_read(uuid) from public;
grant execute on function public.get_my_notifications(integer),public.mark_my_notifications_read(uuid) to authenticated;
