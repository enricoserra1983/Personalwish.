-- PersonalWish: funzioni di supporto per la schermata Amici e permessi lista.
create or replace function public.get_my_friends()
returns table(user_id uuid, display_name text)
language sql stable security definer set search_path=public set row_security=off
as $$
 select p.id,p.display_name from public.friendships f
 join public.profiles p on p.id=case when f.user_low=auth.uid() then f.user_high else f.user_low end
 where auth.uid() in (f.user_low,f.user_high)
 order by p.display_name;
$$;

create or replace function public.get_my_friend_requests()
returns table(id uuid, requester_id uuid, requester_name text, wishlist_id uuid, wishlist_title text, created_at timestamptz)
language sql stable security definer set search_path=public set row_security=off
as $$
 select r.id,r.requester_id,p.display_name,r.wishlist_id,w.title,r.created_at
 from public.friend_requests r
 join public.profiles p on p.id=r.requester_id
 left join public.wishlists w on w.id=r.wishlist_id
 where r.recipient_id=auth.uid() and r.status='pending'
 order by r.created_at desc;
$$;

create or replace function public.set_wishlist_access(p_wishlist_id uuid,p_is_public boolean,p_mode text)
returns boolean
language plpgsql security definer set search_path=public set row_security=off
as $$
begin
 if auth.uid() is null then raise exception 'Devi accedere'; end if;
 if p_mode not in ('all_friends','selected') then raise exception 'Modalità non valida'; end if;
 update public.wishlists set is_public=p_is_public, private_access_mode=p_mode
 where id=p_wishlist_id and owner_id=auth.uid();
 if not found then raise exception 'Lista non trovata'; end if;
 if p_is_public then
   delete from public.wishlist_members m using public.wishlists w
   where m.wishlist_id=w.id and w.id=p_wishlist_id and m.user_id<>auth.uid();
 end if;
 return true;
end;
$$;

create or replace function public.set_wishlist_friend_access(p_wishlist_id uuid,p_friend_id uuid,p_allow boolean)
returns boolean
language plpgsql security definer set search_path=public set row_security=off
as $$
declare v_low uuid; v_high uuid;
begin
 if auth.uid() is null then raise exception 'Devi accedere'; end if;
 if not exists(select 1 from public.wishlists where id=p_wishlist_id and owner_id=auth.uid() and is_public=false and private_access_mode='selected') then
   raise exception 'Lista non disponibile per la gestione degli amici selezionati';
 end if;
 v_low:=least(auth.uid(),p_friend_id); v_high:=greatest(auth.uid(),p_friend_id);
 if not exists(select 1 from public.friendships where user_low=v_low and user_high=v_high) then raise exception 'Questo utente non è un tuo amico'; end if;
 if p_allow then
   insert into public.wishlist_members(wishlist_id,user_id,role) values(p_wishlist_id,p_friend_id,'participant')
   on conflict(wishlist_id,user_id) do nothing;
 else
   delete from public.wishlist_members where wishlist_id=p_wishlist_id and user_id=p_friend_id;
 end if;
 return true;
end;
$$;

revoke all on function public.get_my_friends() from public;
revoke all on function public.get_my_friend_requests() from public;
revoke all on function public.set_wishlist_access(uuid,boolean,text) from public;
revoke all on function public.set_wishlist_friend_access(uuid,uuid,boolean) from public;
grant execute on function public.get_my_friends(),public.get_my_friend_requests(),
 public.set_wishlist_access(uuid,boolean,text),public.set_wishlist_friend_access(uuid,uuid,boolean) to authenticated;
