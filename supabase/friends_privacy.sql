-- PersonalWish: amicizie, richieste di accesso e privacy delle liste private.

create table if not exists public.friendships (
  user_low uuid not null references public.profiles(id) on delete cascade,
  user_high uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_low, user_high),
  check (user_low < user_high)
);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  wishlist_id uuid references public.wishlists(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> recipient_id)
);

create unique index if not exists friend_requests_one_pending
  on public.friend_requests (requester_id, recipient_id, coalesce(wishlist_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status = 'pending';

alter table public.friendships enable row level security;
alter table public.friend_requests enable row level security;

drop policy if exists friendships_select_involved on public.friendships;
create policy friendships_select_involved on public.friendships
for select to authenticated
using (user_low = auth.uid() or user_high = auth.uid());

drop policy if exists friend_requests_select_involved on public.friend_requests;
create policy friend_requests_select_involved on public.friend_requests
for select to authenticated
using (requester_id = auth.uid() or recipient_id = auth.uid());

grant select on public.friendships, public.friend_requests to authenticated;
grant usage on schema public to authenticated;

-- Ricerca limitata agli utenti registrati: restituisce solo nome e identificativo.
create or replace function public.search_personalwish_users(p_term text)
returns table (user_id uuid, display_name text)
language sql stable security definer
set search_path = public
set row_security = off
as $$
  select p.id, p.display_name
  from public.profiles p
  where auth.uid() is not null
    and p.id <> auth.uid()
    and length(trim(coalesce(p_term,''))) >= 2
    and p.display_name ilike '%' || trim(p_term) || '%'
  order by p.display_name
  limit 15;
$$;

-- Invia una richiesta di amicizia, eventualmente collegata a una lista privata.
create or replace function public.send_friend_request(p_recipient_id uuid, p_share_token text default null)
returns uuid
language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare
  v_request_id uuid;
  v_wishlist_id uuid;
  v_owner_id uuid;
  v_low uuid;
  v_high uuid;
begin
  if auth.uid() is null then raise exception 'Devi accedere per continuare'; end if;
  if p_recipient_id = auth.uid() then raise exception 'Non puoi inviare una richiesta a te stesso'; end if;

  if p_share_token is not null then
    select id, owner_id into v_wishlist_id, v_owner_id
    from public.wishlists where share_token = p_share_token and is_public = false;
    if v_wishlist_id is null then raise exception 'Lista privata non trovata'; end if;
    if v_owner_id <> p_recipient_id then raise exception 'Richiesta non valida per questa lista'; end if;
  end if;

  v_low := least(auth.uid(), p_recipient_id);
  v_high := greatest(auth.uid(), p_recipient_id);
  if exists(select 1 from public.friendships f where f.user_low=v_low and f.user_high=v_high) then
    if v_wishlist_id is not null then
      insert into public.wishlist_members(wishlist_id,user_id,role)
      values(v_wishlist_id,auth.uid(),'participant')
      on conflict(wishlist_id,user_id) do nothing;
      return null;
    end if;
    raise exception 'Siete già amici';
  end if;

  select id into v_request_id from public.friend_requests
  where requester_id=auth.uid() and recipient_id=p_recipient_id
    and wishlist_id is not distinct from v_wishlist_id and status='pending'
  limit 1;
  if v_request_id is not null then return v_request_id; end if;

  insert into public.friend_requests(requester_id,recipient_id,wishlist_id)
  values(auth.uid(),p_recipient_id,v_wishlist_id)
  returning id into v_request_id;
  return v_request_id;
end;
$$;

create or replace function public.respond_friend_request(p_request_id uuid, p_accept boolean)
returns boolean
language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare
  v_request public.friend_requests%rowtype;
  v_low uuid;
  v_high uuid;
begin
  if auth.uid() is null then raise exception 'Devi accedere per continuare'; end if;
  select * into v_request from public.friend_requests
  where id=p_request_id and recipient_id=auth.uid() and status='pending'
  for update;
  if not found then raise exception 'Richiesta non trovata o già gestita'; end if;

  update public.friend_requests
  set status=case when p_accept then 'accepted' else 'rejected' end,
      responded_at=now()
  where id=p_request_id;

  if p_accept then
    v_low := least(v_request.requester_id, v_request.recipient_id);
    v_high := greatest(v_request.requester_id, v_request.recipient_id);
    insert into public.friendships(user_low,user_high)
    values(v_low,v_high) on conflict do nothing;

    if v_request.wishlist_id is not null then
      insert into public.wishlist_members(wishlist_id,user_id,role)
      values(v_request.wishlist_id,v_request.requester_id,'participant')
      on conflict(wishlist_id,user_id) do nothing;
    end if;
  end if;
  return true;
end;
$$;

-- Rimuovere un amico revoca anche la sua partecipazione alle liste private dell'utente.
create or replace function public.remove_personalwish_friend(p_friend_id uuid)
returns boolean
language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare v_low uuid; v_high uuid;
begin
  if auth.uid() is null then raise exception 'Devi accedere per continuare'; end if;
  v_low := least(auth.uid(),p_friend_id);
  v_high := greatest(auth.uid(),p_friend_id);
  delete from public.friendships where user_low=v_low and user_high=v_high;
  delete from public.wishlist_members m
  using public.wishlists w
  where m.wishlist_id=w.id and w.owner_id=auth.uid() and m.user_id=p_friend_id;
  return true;
end;
$$;

-- Il link continua a funzionare per le liste pubbliche. Per quelle private
-- restituisce soltanto lo stato di richiesta, senza esporre titolo o desideri.
create or replace function public.get_shared_wishlist(p_share_token text)
returns jsonb
language plpgsql stable security definer
set search_path = public
set row_security = off
as $$
declare
  v_w public.wishlists%rowtype;
  v_items jsonb;
begin
  select * into v_w from public.wishlists where share_token=p_share_token;
  if not found then return null; end if;

  if not v_w.is_public
     and auth.uid() is distinct from v_w.owner_id
     and not exists(select 1 from public.wishlist_members m
                    where m.wishlist_id=v_w.id and m.user_id=auth.uid()) then
    return jsonb_build_object('access_required',true,'owner_id',v_w.owner_id);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',i.id,'title',i.title,'description',i.description,
    'image_url',i.image_url,'product_url',i.product_url,
    'price',i.price,'currency',i.currency
  ) order by i.position,i.created_at),'[]'::jsonb)
  into v_items from public.wishlist_items i where i.wishlist_id=v_w.id;

  return jsonb_build_object(
    'id',v_w.id,'title',v_w.title,'description',v_w.description,'items',v_items,
    'owner_id',v_w.owner_id,'is_public',v_w.is_public
  );
end;
$$;

revoke all on function public.search_personalwish_users(text) from public;
revoke all on function public.send_friend_request(uuid,text) from public;
revoke all on function public.respond_friend_request(uuid,boolean) from public;
revoke all on function public.remove_personalwish_friend(uuid) from public;
revoke all on function public.get_shared_wishlist(text) from public;
grant execute on function public.search_personalwish_users(text) to authenticated;
grant execute on function public.send_friend_request(uuid,text) to authenticated;
grant execute on function public.respond_friend_request(uuid,boolean) to authenticated;
grant execute on function public.remove_personalwish_friend(uuid) to authenticated;
grant execute on function public.get_shared_wishlist(text) to anon, authenticated;
