-- PersonalWish: policy RLS iniziali.
-- Le prenotazioni altrui restano non leggibili direttamente: in seguito saranno esposte
-- tramite funzioni sicure che rispettano le impostazioni privacy.

create or replace function public.is_wishlist_owner(p_id uuid)
returns boolean language sql stable security definer set search_path=public set row_security=off
as $$ select exists(select 1 from public.wishlists where id=p_id and owner_id=auth.uid()); $$;

create or replace function public.is_wishlist_member(p_id uuid)
returns boolean language sql stable security definer set search_path=public set row_security=off
as $$ select exists(select 1 from public.wishlist_members where wishlist_id=p_id and user_id=auth.uid()); $$;

create or replace function public.is_group_owner(p_id uuid)
returns boolean language sql stable security definer set search_path=public set row_security=off
as $$ select exists(select 1 from public.groups where id=p_id and owner_id=auth.uid()); $$;

create or replace function public.is_group_member(p_id uuid)
returns boolean language sql stable security definer set search_path=public set row_security=off
as $$ select exists(select 1 from public.group_members where group_id=p_id and user_id=auth.uid()); $$;

grant execute on function public.is_wishlist_owner(uuid), public.is_wishlist_member(uuid),
 public.is_group_owner(uuid), public.is_group_member(uuid) to authenticated;

-- Profili personali
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using(id=auth.uid());
create policy profiles_insert_own on public.profiles for insert to authenticated with check(id=auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());

-- Liste: lettura proprietario/membri, modifiche solo proprietario
drop policy if exists wishlists_select_accessible on public.wishlists;
drop policy if exists wishlists_insert_owner on public.wishlists;
drop policy if exists wishlists_update_owner on public.wishlists;
drop policy if exists wishlists_delete_owner on public.wishlists;
create policy wishlists_select_accessible on public.wishlists for select to authenticated
 using(owner_id=auth.uid() or public.is_wishlist_member(id));
create policy wishlists_insert_owner on public.wishlists for insert to authenticated with check(owner_id=auth.uid());
create policy wishlists_update_owner on public.wishlists for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy wishlists_delete_owner on public.wishlists for delete to authenticated using(owner_id=auth.uid());

-- Elementi delle liste
drop policy if exists wishlist_items_select_accessible on public.wishlist_items;
drop policy if exists wishlist_items_insert_owner on public.wishlist_items;
drop policy if exists wishlist_items_update_owner on public.wishlist_items;
drop policy if exists wishlist_items_delete_owner on public.wishlist_items;
create policy wishlist_items_select_accessible on public.wishlist_items for select to authenticated
 using(public.is_wishlist_owner(wishlist_id) or public.is_wishlist_member(wishlist_id));
create policy wishlist_items_insert_owner on public.wishlist_items for insert to authenticated with check(public.is_wishlist_owner(wishlist_id));
create policy wishlist_items_update_owner on public.wishlist_items for update to authenticated using(public.is_wishlist_owner(wishlist_id)) with check(public.is_wishlist_owner(wishlist_id));
create policy wishlist_items_delete_owner on public.wishlist_items for delete to authenticated using(public.is_wishlist_owner(wishlist_id));

-- Partecipanti: ciascuno vede sempre se stesso; gli altri solo in base alla privacy.
drop policy if exists wishlist_members_select_privacy on public.wishlist_members;
drop policy if exists wishlist_members_insert_owner on public.wishlist_members;
drop policy if exists wishlist_members_delete_owner_or_self on public.wishlist_members;
create policy wishlist_members_select_privacy on public.wishlist_members for select to authenticated using(
 user_id=auth.uid() or exists(select 1 from public.wishlists w where w.id=wishlist_id and
 ((w.owner_id=auth.uid() and w.owner_sees_participants) or
 (public.is_wishlist_member(w.id) and w.participants_see_participants))));
create policy wishlist_members_insert_owner on public.wishlist_members for insert to authenticated with check(public.is_wishlist_owner(wishlist_id));
create policy wishlist_members_delete_owner_or_self on public.wishlist_members for delete to authenticated using(public.is_wishlist_owner(wishlist_id) or user_id=auth.uid());

-- Prenotazioni: lettura diretta limitata alle proprie; niente fuga di identità altrui.
drop policy if exists reservations_select_own on public.reservations;
drop policy if exists reservations_insert_self on public.reservations;
drop policy if exists reservations_update_own on public.reservations;
drop policy if exists reservations_delete_own on public.reservations;
create policy reservations_select_own on public.reservations for select to authenticated using(user_id=auth.uid());
create policy reservations_insert_self on public.reservations for insert to authenticated with check(
 user_id=auth.uid() and exists(select 1 from public.wishlist_items i where i.id=item_id and
 (public.is_wishlist_owner(i.wishlist_id) or public.is_wishlist_member(i.wishlist_id))));
create policy reservations_update_own on public.reservations for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy reservations_delete_own on public.reservations for delete to authenticated using(user_id=auth.uid());

-- Gruppi
drop policy if exists groups_select_accessible on public.groups;
drop policy if exists groups_insert_owner on public.groups;
drop policy if exists groups_update_owner on public.groups;
drop policy if exists groups_delete_owner on public.groups;
create policy groups_select_accessible on public.groups for select to authenticated using(owner_id=auth.uid() or public.is_group_member(id));
create policy groups_insert_owner on public.groups for insert to authenticated with check(owner_id=auth.uid());
create policy groups_update_owner on public.groups for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy groups_delete_owner on public.groups for delete to authenticated using(owner_id=auth.uid());

-- Membri dei gruppi
drop policy if exists group_members_select_accessible on public.group_members;
drop policy if exists group_members_insert_owner on public.group_members;
drop policy if exists group_members_delete_owner_or_self on public.group_members;
create policy group_members_select_accessible on public.group_members for select to authenticated using(user_id=auth.uid() or public.is_group_owner(group_id));
create policy group_members_insert_owner on public.group_members for insert to authenticated with check(public.is_group_owner(group_id));
create policy group_members_delete_owner_or_self on public.group_members for delete to authenticated using(public.is_group_owner(group_id) or user_id=auth.uid());

-- Associazione liste/gruppi: gestita dal proprietario del gruppo, solo per le proprie liste.
drop policy if exists group_wishlists_select_accessible on public.group_wishlists;
drop policy if exists group_wishlists_insert_owner on public.group_wishlists;
drop policy if exists group_wishlists_delete_owner on public.group_wishlists;
create policy group_wishlists_select_accessible on public.group_wishlists for select to authenticated using(public.is_group_owner(group_id) or public.is_group_member(group_id));
create policy group_wishlists_insert_owner on public.group_wishlists for insert to authenticated with check(public.is_group_owner(group_id) and public.is_wishlist_owner(wishlist_id));
create policy group_wishlists_delete_owner on public.group_wishlists for delete to authenticated using(public.is_group_owner(group_id));
