-- MyPersonalWish: enforce notification preferences at database level.
-- If the owner disabled list activity notifications, no list activity
-- notification is inserted (participant joins, reservations, purchases, updates).

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
begin
  select
    coalesce(p.notify_friend_requests, true),
    coalesce(p.notify_list_activity, true)
  into v_friend, v_activity
  from public.profiles p
  where p.id = new.user_id;

  -- A missing profile must fail closed for notifications.
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

  return new;
end;
$$;

drop trigger if exists trg_apply_notification_preferences on public.notifications;
create trigger trg_apply_notification_preferences
before insert on public.notifications
for each row
execute function public.apply_notification_preferences();

revoke all on function public.apply_notification_preferences() from public, anon, authenticated;
