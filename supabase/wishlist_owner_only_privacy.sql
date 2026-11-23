-- PersonalWish: aggiunge la modalità di accesso "solo proprietario".
create or replace function public.set_wishlist_access(p_wishlist_id uuid,p_is_public boolean,p_mode text)
returns boolean
language plpgsql security definer set search_path=public set row_security=off
as $$
begin
 if auth.uid() is null then raise exception 'Devi accedere'; end if;
 if p_mode not in ('all_friends','selected','owner_only') then raise exception 'Modalità non valida'; end if;
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
