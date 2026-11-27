-- PersonalWish: accesso facoltativo alle liste private tramite un amico in comune.
-- L'intermediario deve aver consentito la visibilita indiretta e il proprietario
-- deve aver reso visibile la propria rete. Non vengono esposti i nomi degli amici in comune.

alter table public.wishlists drop constraint if exists wishlists_private_access_mode_check;
alter table public.wishlists add constraint wishlists_private_access_mode_check
  check (private_access_mode in ('all_friends','selected','owner_only','friends_of_friends'));

create or replace function public.can_view_wishlist_as_friend_of_friend(p_owner_id uuid)
returns boolean
language sql stable security definer
set search_path=public
set row_security=off
as $$
  select auth.uid() is not null
    and auth.uid() <> p_owner_id
    and exists (
      select 1
      from public.profiles owner_profile
      join public.friendships owner_link
        on (owner_link.user_low = p_owner_id or owner_link.user_high = p_owner_id)
      join public.profiles mutual_profile
        on mutual_profile.id = case
          when owner_link.user_low = p_owner_id then owner_link.user_high
          else owner_link.user_low end
      join public.friendships viewer_link
        on (viewer_link.user_low = auth.uid() or viewer_link.user_high = auth.uid())
       and (viewer_link.user_low = mutual_profile.id or viewer_link.user_high = mutual_profile.id)
      where owner_profile.id = p_owner_id
        and coalesce(mutual_profile.allow_indirect_friend_visibility,true)
        and (
          owner_profile.friend_network_visibility = 'all'
          or (owner_profile.friend_network_visibility = 'except'
              and not (mutual_profile.id = any(coalesce(owner_profile.friend_network_excluded_ids,'{}'::uuid[]))))
        )
    );
$$;
revoke all on function public.can_view_wishlist_as_friend_of_friend(uuid) from public, anon;
grant execute on function public.can_view_wishlist_as_friend_of_friend(uuid) to authenticated;

create or replace function public.set_wishlist_access(p_wishlist_id uuid,p_is_public boolean,p_mode text)
returns boolean
language plpgsql security definer set search_path=public set row_security=off
as $$
begin
 if auth.uid() is null then raise exception 'Devi accedere'; end if;
 if p_mode not in ('all_friends','selected','owner_only','friends_of_friends') then raise exception 'Modalità non valida'; end if;
 update public.wishlists set is_public=p_is_public, private_access_mode=p_mode
 where id=p_wishlist_id and owner_id=auth.uid();
 if not found then raise exception 'Lista non trovata'; end if;
 if p_is_public or p_mode='owner_only' then
   delete from public.wishlist_members m
   where m.wishlist_id=p_wishlist_id and m.user_id<>auth.uid();
 end if;
 return true;
end;
$$;
revoke all on function public.set_wishlist_access(uuid,boolean,text) from public;
grant execute on function public.set_wishlist_access(uuid,boolean,text) to authenticated;

create or replace function public.get_public_wishlists_for_user(p_user_id uuid)
returns table (id uuid,title text,description text,share_token text,created_at timestamptz,image_url text)
language sql stable security definer set search_path=public set row_security=off
as $$
 select w.id,w.title,w.description,w.share_token,w.created_at,w.image_url
 from public.wishlists w
 where w.owner_id=p_user_id
   and (
     w.is_public = true
     or (w.is_public = false and w.private_access_mode='friends_of_friends'
         and public.can_view_wishlist_as_friend_of_friend(w.owner_id))
   )
 order by w.created_at desc;
$$;
revoke all on function public.get_public_wishlists_for_user(uuid) from public, anon;
grant execute on function public.get_public_wishlists_for_user(uuid) to authenticated;

create or replace function public.get_shared_wishlist(p_share_token text)
returns jsonb
language plpgsql security definer set search_path=public set row_security=off
as $$
declare
 v_w public.wishlists%rowtype;
 v_items jsonb;
 v_participants jsonb := '[]'::jsonb;
 v_can_see_participants boolean := false;
 v_can_see_reservations boolean := false;
 v_can_see_buyer boolean := false;
begin
 select * into v_w from public.wishlists where share_token=p_share_token;
 if not found then return null; end if;

 if not v_w.is_public
    and auth.uid() is distinct from v_w.owner_id
    and not exists(select 1 from public.wishlist_members m where m.wishlist_id=v_w.id and m.user_id=auth.uid())
    and not (
      (v_w.private_access_mode='all_friends' and exists(
        select 1 from public.friendships f
        where (f.user_low=auth.uid() and f.user_high=v_w.owner_id)
           or (f.user_high=auth.uid() and f.user_low=v_w.owner_id)))
      or (v_w.private_access_mode='friends_of_friends'
          and public.can_view_wishlist_as_friend_of_friend(v_w.owner_id))
    ) then
   return jsonb_build_object('access_required',true,'owner_id',v_w.owner_id);
 end if;

 if not v_w.is_public and auth.uid() is not null and auth.uid()<>v_w.owner_id
    and v_w.private_access_mode='all_friends'
    and exists(select 1 from public.friendships f
      where (f.user_low=auth.uid() and f.user_high=v_w.owner_id)
         or (f.user_high=auth.uid() and f.user_low=v_w.owner_id)) then
   insert into public.wishlist_members(wishlist_id,user_id,role)
   values(v_w.id,auth.uid(),'participant') on conflict(wishlist_id,user_id) do nothing;
 end if;

 v_can_see_participants := case when auth.uid()=v_w.owner_id
   then coalesce(v_w.owner_sees_participants,true)
   else coalesce(v_w.participants_see_participants,true) end;
 v_can_see_reservations := case when auth.uid()=v_w.owner_id
   then coalesce(v_w.owner_sees_reservations,true)
   else coalesce(v_w.participants_see_participants,true) end;
 v_can_see_buyer := case when auth.uid()=v_w.owner_id
   then coalesce(v_w.owner_sees_buyer,true)
   else coalesce(v_w.participants_see_buyer,true) end;

 select coalesce(jsonb_agg(jsonb_build_object(
   'id',i.id,'title',i.title,'description',i.description,'image_url',i.image_url,
   'product_url',i.product_url,'price',i.price,'currency',i.currency,
   'reserved',case when v_can_see_reservations then exists(
     select 1 from public.reservations r where r.item_id=i.id and r.status in ('reserved','purchased'))
     else false end,
   'reserved_by',case when v_can_see_reservations and v_can_see_buyer and auth.uid() is not null then (
     select p.display_name from public.reservations r join public.profiles p on p.id=r.user_id
     where r.item_id=i.id and r.status in ('reserved','purchased')
     order by r.created_at desc limit 1) else null end
 ) order by i.position,i.created_at),'[]'::jsonb)
 into v_items from public.wishlist_items i where i.wishlist_id=v_w.id;

 if v_can_see_participants and auth.uid() is not null then
   select coalesce(jsonb_agg(jsonb_build_object('user_id',p.id,'display_name',p.display_name)
      order by p.display_name),'[]'::jsonb)
   into v_participants from public.wishlist_members m
   join public.profiles p on p.id=m.user_id
   where m.wishlist_id=v_w.id and m.user_id<>v_w.owner_id
     and exists(select 1 from public.friendships f
       where (f.user_low=auth.uid() and f.user_high=m.user_id)
          or (f.user_high=auth.uid() and f.user_low=m.user_id));
 end if;

 return jsonb_build_object('id',v_w.id,'title',v_w.title,'description',v_w.description,
   'items',v_items,'participants',v_participants,'owner_id',v_w.owner_id,'is_public',v_w.is_public);
end;
$$;
revoke all on function public.get_shared_wishlist(text) from public;
grant execute on function public.get_shared_wishlist(text) to anon, authenticated;

create or replace function public.can_read_wishlist_image(object_name text)
returns boolean
language plpgsql stable security definer
set search_path=public,storage,pg_temp set row_security=off
as $$
declare
 v_parts text[]; v_owner_id text; v_wishlist_id text;
begin
 v_parts:=storage.foldername(object_name);
 if coalesce(array_length(v_parts,1),0)<2 then return false; end if;
 v_owner_id:=v_parts[1]; v_wishlist_id:=v_parts[2];
 if v_wishlist_id='profile' then
   return auth.uid() is not null and v_owner_id=auth.uid()::text;
 end if;
 return exists(select 1 from public.wishlists w
   where w.id::text=v_wishlist_id and w.owner_id::text=v_owner_id
   and (w.is_public=true or auth.uid()=w.owner_id
     or exists(select 1 from public.wishlist_members m where m.wishlist_id=w.id and m.user_id=auth.uid())
     or (w.private_access_mode='all_friends' and auth.uid() is not null and exists(
       select 1 from public.friendships f where (f.user_low=auth.uid() and f.user_high=w.owner_id)
        or (f.user_high=auth.uid() and f.user_low=w.owner_id)))
     or (w.private_access_mode='friends_of_friends' and public.can_view_wishlist_as_friend_of_friend(w.owner_id))
   ));
end;
$$;
revoke all on function public.can_read_wishlist_image(text) from public;
grant execute on function public.can_read_wishlist_image(text) to anon, authenticated;
drop policy if exists "Wishlist images are publicly viewable" on storage.objects;
drop policy if exists "Wishlist images readable by authorized viewers" on storage.objects;
create policy "Wishlist images readable by authorized viewers" on storage.objects
for select to anon,authenticated using(bucket_id='wishlist-images' and public.can_read_wishlist_image(name));
update storage.buckets set public=false where id='wishlist-images';
