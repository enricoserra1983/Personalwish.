-- PersonalWish: colonna persistente per l'ordine manuale dei desideri.
alter table public.wishlist_items
  add column if not exists position integer;

with ranked as (
  select id, row_number() over (partition by wishlist_id order by created_at asc, id asc) - 1 as new_position
  from public.wishlist_items
)
update public.wishlist_items as item
set position = ranked.new_position
from ranked
where item.id = ranked.id and item.position is null;

create index if not exists wishlist_items_wishlist_position_idx
  on public.wishlist_items (wishlist_id, position);
