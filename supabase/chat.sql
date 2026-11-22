-- PersonalWish: chat privata con partecipazione facoltativa del creatore.
-- MIGRAZIONE: eseguire nel Supabase SQL Editor anche se la vecchia chat.sql
-- era già stata eseguita. Le istruzioni sono idempotenti.

create table if not exists public.wishlist_messages (
  id uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references public.wishlists(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  sender_name text not null,
  body text not null check (char_length(trim(body)) between 1 and 1500),
  created_at timestamptz not null default now()
);

create index if not exists wishlist_messages_list_created_idx
  on public.wishlist_messages (wishlist_id, created_at);

-- Modalità di accesso del creatore: escluso (predefinito), lettura/scrittura
-- solo dal momento dell'ingresso, oppure scrittura + lettura dei soli messaggi
-- che i partecipanti non hanno contrassegnato come privati verso il creatore.
alter table public.wishlists
  add column if not exists chat_creator_mode text not null default 'excluded'
  check (chat_creator_mode in ('excluded', 'from_now', 'write_only_private'));
alter table public.wishlists
  add column if not exists chat_creator_joined_at timestamptz;

-- Ogni partecipante può nascondere i propri messaggi al creatore.
alter table public.wishlist_members
  add column if not exists hide_messages_from_owner boolean not null default false;

alter table public.wishlist_messages
  add column if not exists message_type text not null default 'user'
  check (message_type in ('user', 'system'));
alter table public.wishlist_messages
  add column if not exists is_private_from_owner boolean not null default false;

alter table public.wishlist_messages alter column sender_id drop not null;

alter table public.wishlist_messages enable row level security;

-- Funzione di lettura: bypass RLS solo per verificare in modo sicuro ruolo,
-- modalità, data di ingresso e preferenza di riservatezza del mittente.
create or replace function public.can_read_wishlist_message(
  p_wishlist_id uuid,
  p_sender_id uuid,
  p_created_at timestamptz,
  p_message_type text
)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    exists (
      select 1
      from public.wishlists w
      join public.wishlist_members wm on wm.wishlist_id = w.id
      where w.id = p_wishlist_id
        and wm.user_id = auth.uid()
        and wm.role = 'participant'
        and w.owner_id <> auth.uid()
    )
    or
    exists (
      select 1
      from public.wishlists w
      where w.id = p_wishlist_id
        and w.owner_id = auth.uid()
        and w.chat_creator_mode in ('from_now', 'write_only_private')
        and w.chat_creator_joined_at is not null
        and p_created_at >= w.chat_creator_joined_at
        and (
          w.chat_creator_mode = 'from_now'
          or p_message_type = 'system'
          or p_sender_id = auth.uid()
          or not exists (
            select 1
            from public.wishlist_members wm
            where wm.wishlist_id = w.id
              and wm.user_id = p_sender_id
              and wm.hide_messages_from_owner = true
          )
        )
    );
$$;

create or replace function public.can_send_wishlist_message(p_wishlist_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    exists (
      select 1 from public.wishlists w
      join public.wishlist_members wm on wm.wishlist_id = w.id
      where w.id = p_wishlist_id
        and wm.user_id = auth.uid()
        and wm.role = 'participant'
        and w.owner_id <> auth.uid()
    )
    or exists (
      select 1 from public.wishlists w
      where w.id = p_wishlist_id
        and w.owner_id = auth.uid()
        and w.chat_creator_mode in ('from_now', 'write_only_private')
        and w.chat_creator_joined_at is not null
    );
$$;

grant execute on function public.can_read_wishlist_message(uuid, uuid, timestamptz, text)
  to authenticated;
grant execute on function public.can_send_wishlist_message(uuid)
  to authenticated;

drop policy if exists wishlist_messages_select_participants on public.wishlist_messages;
drop policy if exists wishlist_messages_select_accessible on public.wishlist_messages;
create policy wishlist_messages_select_accessible
  on public.wishlist_messages
  for select
  to authenticated
  using (public.can_read_wishlist_message(wishlist_id, sender_id, created_at, message_type));

drop policy if exists wishlist_messages_insert_participants on public.wishlist_messages;
drop policy if exists wishlist_messages_insert_authorized on public.wishlist_messages;
create policy wishlist_messages_insert_authorized
  on public.wishlist_messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and message_type = 'user'
    and public.can_send_wishlist_message(wishlist_id)
  );

grant select, insert on public.wishlist_messages to authenticated;

-- Il nome del mittente è ricavato dal profilo, non dal browser.
create or replace function public.set_wishlist_message_sender_name()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if new.message_type = 'system' then
    new.sender_name := 'PersonalWish';
    new.sender_id := null;
    new.is_private_from_owner := false;
  else
    select coalesce(nullif(trim(p.display_name), ''), 'Partecipante')
      into new.sender_name
    from public.profiles p
    where p.id = new.sender_id;
    if new.sender_name is null then
      new.sender_name := 'Partecipante';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists wishlist_message_sender_name on public.wishlist_messages;
create trigger wishlist_message_sender_name
  before insert on public.wishlist_messages
  for each row execute function public.set_wishlist_message_sender_name();

-- Il creatore può scegliere di entrare. L'ingresso parte da ORA:
-- i messaggi precedenti non diventano visibili. Il messaggio di sistema
-- avvisa tutti i partecipanti della sua presenza.
create or replace function public.set_wishlist_chat_creator_mode(
  p_wishlist_id uuid,
  p_mode text
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_owner_id uuid;
begin
  if p_mode not in ('excluded', 'from_now', 'write_only_private') then
    raise exception 'Modalità chat non valida';
  end if;

  select owner_id into v_owner_id
  from public.wishlists
  where id = p_wishlist_id;

  if v_owner_id is null or v_owner_id <> auth.uid() then
    raise exception 'Solo il creatore della lista può modificare questa impostazione';
  end if;

  update public.wishlists
  set chat_creator_mode = p_mode,
      chat_creator_joined_at = case
        when p_mode = 'excluded' then null
        else now()
      end
  where id = p_wishlist_id;

  if p_mode = 'excluded' then
    insert into public.wishlist_messages (wishlist_id, sender_id, sender_name, body, message_type)
    values (p_wishlist_id, null, 'PersonalWish',
      'Il creatore ha lasciato la chat.', 'system');
  else
    insert into public.wishlist_messages (wishlist_id, sender_id, sender_name, body, message_type)
    values (p_wishlist_id, null, 'PersonalWish',
      'Il creatore della lista è entrato nella chat. Da questo momento può partecipare secondo le impostazioni di privacy.', 'system');
  end if;
end;
$$;

grant execute on function public.set_wishlist_chat_creator_mode(uuid, text)
  to authenticated;

-- Preferenza individuale: ciascun partecipante può nascondere i propri
-- messaggi al creatore nella modalità write_only_private.
drop policy if exists wishlist_members_update_own_chat_privacy on public.wishlist_members;
create policy wishlist_members_update_own_chat_privacy
  on public.wishlist_members
  for update
  to authenticated
  using (user_id = auth.uid() and role = 'participant')
  with check (user_id = auth.uid() and role = 'participant');

grant update (hide_messages_from_owner) on public.wishlist_members to authenticated;

-- Nessuna policy UPDATE/DELETE sui messaggi: non possono essere alterati
-- o cancellati dagli utenti tramite l'API.
