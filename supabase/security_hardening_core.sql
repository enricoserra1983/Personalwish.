-- PersonalWish security hardening - core wishlist tables.
-- Safe/idempotent migration. Does not delete or rewrite user data.

-- 1) Enable Row Level Security on core tables.
alter table public.profiles enable row level security;
alter table public.wishlists enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.wishlist_members enable row level security;
alter table public.reservations enable row level security;

-- 2) Profiles: a user can read/write only their own profile through the table API.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- 3) Wishlists: owners and explicit members can read. Only owners can mutate.
drop policy if exists wishlists_select_accessible on public.wishlists;
create policy wishlists_select_accessible on public.wishlists
  for select to authenticated
  using (owner_id = auth.uid() or public.is_wishlist_member(id));
drop policy if exists wishlists_insert_owner on public.wishlists;
create policy wishlists_insert_owner on public.wishlists
  for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists wishlists_update_owner on public.wishlists;
create policy wishlists_update_owner on public.wishlists
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists wishlists_delete_owner on public.wishlists;
create policy wishlists_delete_owner on public.wishlists
  for delete to authenticated using (owner_id = auth.uid());

-- 4) Items: readable by owner/members, writable only by owner.
drop policy if exists wishlist_items_select_accessible on public.wishlist_items;
create policy wishlist_items_select_accessible on public.wishlist_items
  for select to authenticated
  using (public.is_wishlist_owner(wishlist_id) or public.is_wishlist_member(wishlist_id));
drop policy if exists wishlist_items_insert_owner on public.wishlist_items;
create policy wishlist_items_insert_owner on public.wishlist_items
  for insert to authenticated with check (public.is_wishlist_owner(wishlist_id));
drop policy if exists wishlist_items_update_owner on public.wishlist_items;
create policy wishlist_items_update_owner on public.wishlist_items
  for update to authenticated using (public.is_wishlist_owner(wishlist_id))
  with check (public.is_wishlist_owner(wishlist_id));
drop policy if exists wishlist_items_delete_owner on public.wishlist_items;
create policy wishlist_items_delete_owner on public.wishlist_items
  for delete to authenticated using (public.is_wishlist_owner(wishlist_id));

-- 5) Memberships: own membership is visible; participant list obeys per-list settings.
drop policy if exists wishlist_members_select_privacy on public.wishlist_members;
create policy wishlist_members_select_privacy on public.wishlist_members
  for select to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from public.wishlists w
      where w.id = wishlist_id
        and (
          (w.owner_id = auth.uid() and coalesce(w.owner_sees_participants, false))
          or (public.is_wishlist_member(w.id) and coalesce(w.participants_see_participants, false))
        )
    )
  );
drop policy if exists wishlist_members_insert_owner on public.wishlist_members;
create policy wishlist_members_insert_owner on public.wishlist_members
  for insert to authenticated with check (public.is_wishlist_owner(wishlist_id));
drop policy if exists wishlist_members_delete_owner_or_self on public.wishlist_members;
create policy wishlist_members_delete_owner_or_self on public.wishlist_members
  for delete to authenticated using (public.is_wishlist_owner(wishlist_id) or user_id = auth.uid());

-- 6) Reservations: direct table reads expose only the caller's own rows.
-- Reservation creation is performed by the guarded SECURITY DEFINER RPC below.
drop policy if exists reservations_select_own on public.reservations;
create policy reservations_select_own on public.reservations
  for select to authenticated using (user_id = auth.uid());
drop policy if exists reservations_insert_self on public.reservations;
create policy reservations_insert_self on public.reservations
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.wishlist_items i
      where i.id = item_id
        and (public.is_wishlist_owner(i.wishlist_id) or public.is_wishlist_member(i.wishlist_id))
    )
  );
drop policy if exists reservations_update_own on public.reservations;
create policy reservations_update_own on public.reservations
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists reservations_delete_own on public.reservations;
create policy reservations_delete_own on public.reservations
  for delete to authenticated using (user_id = auth.uid());

-- 7) Harden the reservation RPC: a valid share token alone must not grant access
-- to a private list. Public lists accept registered users; private lists require
-- owner, an existing member, or a friend when access mode is all_friends.
create or replace function public.reserve_shared_wishlist_item(
  p_share_token text,
  p_item_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_wishlist_id uuid;
  v_owner_id uuid;
  v_is_public boolean;
  v_access_mode text;
begin
  if auth.uid() is null then
    raise exception 'Devi accedere per prenotare un regalo';
  end if;

  select w.id, w.owner_id, w.is_public, w.private_access_mode
    into v_wishlist_id, v_owner_id, v_is_public, v_access_mode
  from public.wishlists w
  join public.wishlist_items i on i.wishlist_id = w.id
  where w.share_token = p_share_token
    and i.id = p_item_id;

  if v_wishlist_id is null then
    raise exception 'Lista o desiderio non trovato';
  end if;

  if v_owner_id = auth.uid() then
    raise exception 'Non puoi prenotare un regalo della tua lista';
  end if;

  if not coalesce(v_is_public, false)
     and not exists (
       select 1 from public.wishlist_members m
       where m.wishlist_id = v_wishlist_id and m.user_id = auth.uid()
     )
     and not (
       v_access_mode = 'all_friends'
       and exists (
         select 1 from public.friendships f
         where (f.user_low = auth.uid() and f.user_high = v_owner_id)
            or (f.user_high = auth.uid() and f.user_low = v_owner_id)
       )
     ) then
    raise exception 'Non sei autorizzato a partecipare a questa lista';
  end if;

  insert into public.wishlist_members (wishlist_id, user_id, role)
  values (v_wishlist_id, auth.uid(), 'participant')
  on conflict (wishlist_id, user_id) do nothing;

  begin
    insert into public.reservations (item_id, user_id, status)
    values (p_item_id, auth.uid(), 'reserved');
  exception when unique_violation then
    return false;
  end;

  return true;
end;
$$;

revoke all on function public.reserve_shared_wishlist_item(text, uuid) from public, anon;
grant execute on function public.reserve_shared_wishlist_item(text, uuid) to authenticated;
