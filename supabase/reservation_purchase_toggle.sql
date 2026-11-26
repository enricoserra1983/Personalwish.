-- MyPersonalWish: stato Acquistato per le prenotazioni condivise.
-- L'utente può segnare come acquistata solo una propria prenotazione attiva.
-- Premendo di nuovo il pulsante, la prenotazione viene eliminata e il desiderio torna libero.

create or replace function public.set_my_reservation_purchased(
  p_share_token text,
  p_item_id uuid,
  p_purchased boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_owner_id uuid;
  v_wishlist_id uuid;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Devi accedere per modificare la prenotazione';
  end if;

  select w.id, w.owner_id
    into v_wishlist_id, v_owner_id
  from public.wishlists w
  join public.wishlist_items i on i.wishlist_id = w.id
  where w.share_token = p_share_token
    and i.id = p_item_id;

  if v_wishlist_id is null then
    raise exception 'Lista o desiderio non trovato';
  end if;

  if v_owner_id = auth.uid() then
    raise exception 'Non puoi modificare la prenotazione di un desiderio della tua lista';
  end if;

  if p_purchased then
    update public.reservations
       set status = 'purchased',
           updated_at = now()
     where item_id = p_item_id
       and user_id = auth.uid()
       and status = 'reserved';
  else
    delete from public.reservations
     where item_id = p_item_id
       and user_id = auth.uid()
       and status in ('reserved', 'purchased');
  end if;

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke all on function public.set_my_reservation_purchased(text, uuid, boolean) from public, anon;
grant execute on function public.set_my_reservation_purchased(text, uuid, boolean) to authenticated;


-- Aggiorna la RPC di lettura mantenendo le regole di privacy già presenti.
-- Il campo purchased è visibile solo agli stessi utenti autorizzati a vedere
-- se il desiderio è prenotato: proprietario e partecipanti seguono le rispettive impostazioni.
create or replace function public.get_shared_wishlist(p_share_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_w public.wishlists%rowtype;
  v_items jsonb;
  v_participants jsonb := '[]'::jsonb;
  v_can_see_participants boolean := false;
  v_can_see_reservations boolean := false;
  v_can_see_buyer boolean := false;
begin
  select * into v_w from public.wishlists where share_token = p_share_token;
  if not found then return null; end if;

  if not v_w.is_public
     and auth.uid() is distinct from v_w.owner_id
     and not exists (
       select 1 from public.wishlist_members m
       where m.wishlist_id = v_w.id and m.user_id = auth.uid()
     )
     and not (
       v_w.private_access_mode = 'all_friends'
       and exists (
         select 1 from public.friendships f
         where (f.user_low = auth.uid() and f.user_high = v_w.owner_id)
            or (f.user_high = auth.uid() and f.user_low = v_w.owner_id)
       )
     ) then
    return jsonb_build_object('access_required', true, 'owner_id', v_w.owner_id);
  end if;

  if not v_w.is_public
     and auth.uid() is not null
     and auth.uid() <> v_w.owner_id
     and v_w.private_access_mode = 'all_friends'
     and exists (
       select 1 from public.friendships f
       where (f.user_low = auth.uid() and f.user_high = v_w.owner_id)
          or (f.user_high = auth.uid() and f.user_low = v_w.owner_id)
     ) then
    insert into public.wishlist_members(wishlist_id, user_id, role)
    values (v_w.id, auth.uid(), 'participant')
    on conflict (wishlist_id, user_id) do nothing;
  end if;

  v_can_see_participants := case
    when auth.uid() = v_w.owner_id then v_w.owner_sees_participants
    else v_w.participants_see_participants
  end;
  v_can_see_reservations := case
    when auth.uid() = v_w.owner_id then v_w.owner_sees_reservations
    else v_w.participants_see_reservations
  end;
  v_can_see_buyer := case
    when auth.uid() = v_w.owner_id then v_w.owner_sees_buyer
    else v_w.participants_see_buyer
  end;

  if v_can_see_participants and auth.uid() is not null then
    select coalesce(
      jsonb_agg(
        jsonb_build_object('user_id', p.id, 'display_name', p.display_name)
        order by p.display_name
      ),
      '[]'::jsonb
    )
    into v_participants
    from public.wishlist_members m
    join public.profiles p on p.id = m.user_id
    where m.wishlist_id = v_w.id
      and m.user_id <> v_w.owner_id
      and exists (
        select 1 from public.friendships f
        where (f.user_low = auth.uid() and f.user_high = m.user_id)
           or (f.user_high = auth.uid() and f.user_low = m.user_id)
      );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'title', i.title,
        'description', i.description,
        'image_url', i.image_url,
        'product_url', i.product_url,
        'price', i.price,
        'currency', i.currency,
        'reserved', case when v_can_see_reservations then exists (
          select 1 from public.reservations r
          where r.item_id = i.id and r.status in ('reserved', 'purchased')
        ) else false end,
        'purchased', case when v_can_see_reservations then exists (
          select 1 from public.reservations r
          where r.item_id = i.id and r.status = 'purchased'
        ) else false end,
        'reserved_by', case when v_can_see_reservations and v_can_see_buyer and auth.uid() is not null then (
          select p.display_name
          from public.reservations r
          join public.profiles p on p.id = r.user_id
          where r.item_id = i.id and r.status in ('reserved', 'purchased')
            and exists (
              select 1 from public.friendships f
              where (f.user_low = auth.uid() and f.user_high = r.user_id)
                 or (f.user_high = auth.uid() and f.user_low = r.user_id)
            )
          order by r.created_at desc
          limit 1
        ) else null end
      ) order by i.position, i.created_at
    ),
    '[]'::jsonb
  )
  into v_items
  from public.wishlist_items i
  where i.wishlist_id = v_w.id;

  return jsonb_build_object(
    'id', v_w.id,
    'title', v_w.title,
    'description', v_w.description,
    'items', v_items,
    'participants', v_participants,
    'owner_id', v_w.owner_id,
    'is_public', v_w.is_public
  );
end;
$$;

revoke all on function public.get_shared_wishlist(text) from public;
grant execute on function public.get_shared_wishlist(text) to anon, authenticated;
