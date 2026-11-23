-- Corregge il vincolo che impediva di salvare la modalità "owner_only".
alter table public.wishlists
  drop constraint if exists wishlists_private_access_mode_check;

alter table public.wishlists
  add constraint wishlists_private_access_mode_check
  check (private_access_mode in ('all_friends', 'selected', 'owner_only'));
