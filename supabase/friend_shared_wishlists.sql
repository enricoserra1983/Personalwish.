-- Elenca solo le liste di un amico effettivamente visibili all'utente autenticato.
-- La funzione viene ricreata perché aggiungiamo image_url al tipo di ritorno.
drop function if exists public.get_friend_shared_wishlists(uuid);
create function public.get_friend_shared_wishlists(p_friend_id uuid)
returns table(id uuid,title text,description text,share_token text,created_at timestamptz,image_url text)
language sql stable security definer
set search_path=public
set row_security=off
as $$
  select w.id,w.title,w.description,w.share_token,w.created_at,w.image_url
  from public.wishlists w
  where w.owner_id=p_friend_id
    and (
      w.is_public = true
      or (
        w.is_public = false
        and (
          (w.private_access_mode='all_friends' and exists (
            select 1 from public.friendships f
            where (f.user_low=auth.uid() and f.user_high=p_friend_id)
               or (f.user_high=auth.uid() and f.user_low=p_friend_id)
          ))
          or exists (
            select 1 from public.wishlist_members m
            where m.wishlist_id=w.id and m.user_id=auth.uid()
          )
        )
      )
    )
  order by w.created_at desc;
$$;

revoke all on function public.get_friend_shared_wishlists(uuid) from public;
grant execute on function public.get_friend_shared_wishlists(uuid) to authenticated;
