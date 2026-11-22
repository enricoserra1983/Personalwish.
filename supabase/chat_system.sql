-- PersonalWish: chat private, gruppi e conversazioni dedicate alle liste.
create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('direct','group','list')),
  title text,
  wishlist_id uuid references public.wishlists(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((type = 'list' and wishlist_id is not null) or (type <> 'list' and wishlist_id is null))
);

create table if not exists public.chat_participants (
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

-- L'unicità delle chat private viene gestita dalla funzione RPC e non da un indice funzionale.

create index if not exists chat_messages_conversation_created
on public.chat_messages(conversation_id, created_at);
create index if not exists chat_participants_user
on public.chat_participants(user_id, conversation_id);

alter table public.chat_conversations enable row level security;
alter table public.chat_participants enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists chat_conversations_read_member on public.chat_conversations;
create policy chat_conversations_read_member on public.chat_conversations
for select to authenticated using (
  exists (select 1 from public.chat_participants p where p.conversation_id = id and p.user_id = auth.uid())
);
drop policy if exists chat_participants_read_member on public.chat_participants;
create policy chat_participants_read_member on public.chat_participants
for select to authenticated using (
  exists (select 1 from public.chat_participants me where me.conversation_id = chat_participants.conversation_id and me.user_id = auth.uid())
);
drop policy if exists chat_messages_read_member on public.chat_messages;
create policy chat_messages_read_member on public.chat_messages
for select to authenticated using (
  exists (select 1 from public.chat_participants p where p.conversation_id = chat_messages.conversation_id and p.user_id = auth.uid())
);
drop policy if exists chat_messages_send_member on public.chat_messages;
create policy chat_messages_send_member on public.chat_messages
for insert to authenticated with check (
  sender_id = auth.uid()
  and exists (select 1 from public.chat_participants p where p.conversation_id = chat_messages.conversation_id and p.user_id = auth.uid())
);

grant select on public.chat_conversations, public.chat_participants, public.chat_messages to authenticated;
grant insert on public.chat_messages to authenticated;

create or replace function public.get_my_chats()
returns table(
  conversation_id uuid, chat_type text, chat_title text, wishlist_id uuid,
  updated_at timestamptz, last_message text, unread_count bigint
)
language sql stable security definer set search_path=public set row_security=off
as $$
  select c.id, c.type,
    case
      when c.type = 'list' then w.title
      when c.type = 'group' then coalesce(c.title, 'Gruppo')
      else coalesce((select p.display_name from public.chat_participants cp join public.profiles p on p.id=cp.user_id
                    where cp.conversation_id=c.id and cp.user_id<>auth.uid() limit 1), 'Chat privata')
    end,
    c.wishlist_id,
    coalesce((select max(m.created_at) from public.chat_messages m where m.conversation_id=c.id), c.created_at),
    (select m.body from public.chat_messages m where m.conversation_id=c.id order by m.created_at desc limit 1),
    (select count(*) from public.chat_messages m
      where m.conversation_id=c.id and m.sender_id<>auth.uid()
      and m.created_at>coalesce(me.last_read_at, me.joined_at))
  from public.chat_conversations c
  join public.chat_participants me on me.conversation_id=c.id and me.user_id=auth.uid()
  left join public.wishlists w on w.id=c.wishlist_id
  order by 5 desc;
$$;

create or replace function public.open_direct_chat(p_friend_id uuid)
returns uuid
language plpgsql security definer set search_path=public set row_security=off
as $$
declare v_id uuid; v_low uuid; v_high uuid;
begin
  if auth.uid() is null or p_friend_id=auth.uid() then raise exception 'Utente non valido'; end if;
  v_low:=least(auth.uid(),p_friend_id); v_high:=greatest(auth.uid(),p_friend_id);
  if not exists(select 1 from public.friendships f where f.user_low=v_low and f.user_high=v_high) then
    raise exception 'Puoi chattare soltanto con un amico';
  end if;
  select c.id into v_id from public.chat_conversations c
  where c.type='direct'
    and exists(select 1 from public.chat_participants p where p.conversation_id=c.id and p.user_id=auth.uid())
    and exists(select 1 from public.chat_participants p where p.conversation_id=c.id and p.user_id=p_friend_id)
    and (select count(*) from public.chat_participants p where p.conversation_id=c.id)=2
  limit 1;
  if v_id is null then
    insert into public.chat_conversations(type,created_by) values('direct',auth.uid()) returning id into v_id;
    insert into public.chat_participants(conversation_id,user_id) values(v_id,auth.uid()),(v_id,p_friend_id);
  end if;
  return v_id;
end;
$$;

create or replace function public.create_group_chat(p_title text,p_member_ids uuid[])
returns uuid
language plpgsql security definer set search_path=public set row_security=off
as $$
declare v_id uuid; v_friend uuid;
begin
  if auth.uid() is null then raise exception 'Devi accedere'; end if;
  if length(trim(coalesce(p_title,''))) not between 1 and 60 then raise exception 'Inserisci un nome per il gruppo'; end if;
  if coalesce(array_length(p_member_ids,1),0)<1 then raise exception 'Seleziona almeno un amico'; end if;
  foreach v_friend in array p_member_ids loop
    if v_friend=auth.uid() or not exists(
      select 1 from public.friendships f
      where f.user_low=least(auth.uid(),v_friend) and f.user_high=greatest(auth.uid(),v_friend)
    ) then raise exception 'Tutti i partecipanti devono essere tuoi amici'; end if;
  end loop;
  insert into public.chat_conversations(type,title,created_by) values('group',trim(p_title),auth.uid()) returning id into v_id;
  insert into public.chat_participants(conversation_id,user_id) values(v_id,auth.uid());
  insert into public.chat_participants(conversation_id,user_id)
    select v_id, x from unnest(p_member_ids) x on conflict do nothing;
  return v_id;
end;
$$;

create or replace function public.open_list_chat(p_wishlist_id uuid)
returns uuid
language plpgsql security definer set search_path=public set row_security=off
as $$
declare v_id uuid; v_w public.wishlists%rowtype;
begin
  if auth.uid() is null then raise exception 'Devi accedere'; end if;
  select * into v_w from public.wishlists where id=p_wishlist_id;
  if not found then raise exception 'Lista non trovata'; end if;
  if auth.uid()<>v_w.owner_id then
    if not exists(select 1 from public.friendships f
      where (f.user_low=least(auth.uid(),v_w.owner_id) and f.user_high=greatest(auth.uid(),v_w.owner_id)))
      or (not v_w.is_public and v_w.private_access_mode='selected' and not exists(
        select 1 from public.wishlist_members wm where wm.wishlist_id=v_w.id and wm.user_id=auth.uid()
      )) then raise exception 'Non sei autorizzato a partecipare alla chat di questa lista'; end if;
  end if;
  select id into v_id from public.chat_conversations where type='list' and wishlist_id=p_wishlist_id limit 1;
  if v_id is null then
    insert into public.chat_conversations(type,wishlist_id,created_by) values('list',p_wishlist_id,v_w.owner_id) returning id into v_id;
    insert into public.chat_participants(conversation_id,user_id) values(v_id,v_w.owner_id);
  end if;
  if not exists(select 1 from public.chat_participants where conversation_id=v_id and user_id=auth.uid()) then
    insert into public.chat_participants(conversation_id,user_id) values(v_id,auth.uid());
  end if;
  return v_id;
end;
$$;

create or replace function public.mark_chat_read(p_conversation_id uuid)
returns boolean
language plpgsql security definer set search_path=public set row_security=off
as $$
begin
  update public.chat_participants set last_read_at=now()
  where conversation_id=p_conversation_id and user_id=auth.uid();
  if not found then raise exception 'Conversazione non trovata'; end if;
  return true;
end;
$$;

revoke all on function public.get_my_chats() from public;
revoke all on function public.open_direct_chat(uuid) from public;
revoke all on function public.create_group_chat(text,uuid[]) from public;
revoke all on function public.open_list_chat(uuid) from public;
revoke all on function public.mark_chat_read(uuid) from public;
grant execute on function public.get_my_chats(),public.open_direct_chat(uuid),
 public.create_group_chat(text,uuid[]),public.open_list_chat(uuid),public.mark_chat_read(uuid) to authenticated;
