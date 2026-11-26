-- MyPersonalWish: enforce both profile and per-wishlist notification preferences.
-- Reservation/purchase notices are suppressed when the wishlist owner has
-- disabled "Il creatore vede quali prodotti sono prenotati".

create or replace function public.apply_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_friend boolean;
  v_activity boolean;
  v_owner_sees_reservations boolean;
begin
  select
    coalesce(p.notify_friend_requests, true),
    coalesce(p.notify_list_activity, true)
  into v_friend, v_activity
  from public.profiles p
  where p.id = new.user_id;

  -- If the recipient profile is missing, do not create the notification.
  if not found then
    return null;
  end if;

  if new.type in ('friend_request','friend_accepted')
     and not v_friend then
    return null;
  end if;

  if new.type in ('list_participant','item_reserved','item_purchased','wishlist_updated')
     and not v_activity then
    return null;
  end if;

  -- Per-list consent: the owner must explicitly allow visibility of
  -- reserved products to receive reservation/purchase activity notices.
  if new.type in ('item_reserved','item_purchased') then
    select coalesce(w.owner_sees_reservations, false)
      into v_owner_sees_reservations
    from public.wishlists w
    where w.id = new.wishlist_id
      and w.owner_id = new.user_id;

    if not found or not v_owner_sees_reservations then
      return null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_notification_preferences on public.notifications;
create trigger trg_apply_notification_preferences
before insert on public.notifications
for each row
execute function public.apply_notification_preferences();

revoke all on function public.apply_notification_preferences() from public, anon, authenticated;
