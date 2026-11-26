-- MyPersonalWish: aggiorna la notifica di prenotazione quando diventa acquisto.
-- Evita due notifiche separate per lo stesso regalo e la stessa persona.

create or replace function public.notify_reservation_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_owner uuid;
  v_list uuid;
  v_title text;
  v_name text;
  v_type text;
  v_heading text;
  v_body text;
  v_notification_id uuid;
begin
  if tg_op = 'INSERT' then
    if new.status not in ('reserved','purchased') then
      return new;
    end if;
  else
    if old.status is not distinct from new.status
       or new.status not in ('reserved','purchased') then
      return new;
    end if;
  end if;

  select w.owner_id, w.id, i.title
    into v_owner, v_list, v_title
  from public.wishlist_items i
  join public.wishlists w on w.id = i.wishlist_id
  where i.id = new.item_id;

  if v_owner is null or v_owner = new.user_id then
    return new;
  end if;

  select display_name into v_name
  from public.profiles
  where id = new.user_id;

  v_type := case when new.status = 'purchased'
                 then 'item_purchased' else 'item_reserved' end;
  v_heading := case when new.status = 'purchased'
                    then 'Regalo acquistato' else 'Desiderio prenotato' end;
  v_body := coalesce(v_name,'Un utente') ||
    case when new.status = 'purchased'
         then ' ha acquistato "' else ' ha prenotato "' end ||
    v_title || '".';

  -- Se la prenotazione diventa acquisto, aggiorna la notifica già inviata.
  if tg_op = 'UPDATE' then
    select id into v_notification_id
    from public.notifications
    where user_id = v_owner
      and actor_id = new.user_id
      and wishlist_id = v_list
      and item_id = new.item_id
      and type in ('item_reserved','item_purchased')
    order by created_at desc
    limit 1;

    if v_notification_id is not null then
      update public.notifications
      set type = v_type,
          title = v_heading,
          body = v_body,
          created_at = now(),
          read_at = null
      where id = v_notification_id;
      return new;
    end if;
  end if;

  insert into public.notifications(user_id,actor_id,type,title,body,wishlist_id,item_id)
  values(v_owner,new.user_id,v_type,v_heading,v_body,v_list,new.item_id);

  return new;
end;
$$;

revoke all on function public.notify_reservation_event() from public, anon, authenticated;

-- Ripulisce le coppie storiche prenotazione/acquisto già duplicate.
delete from public.notifications reserved_notice
using public.notifications purchased_notice
where reserved_notice.type = 'item_reserved'
  and purchased_notice.type = 'item_purchased'
  and reserved_notice.user_id = purchased_notice.user_id
  and reserved_notice.actor_id = purchased_notice.actor_id
  and reserved_notice.wishlist_id = purchased_notice.wishlist_id
  and reserved_notice.item_id = purchased_notice.item_id;
