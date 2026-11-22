-- PersonalWish: chat privata dei partecipanti.
-- Eseguire una sola volta nel Supabase SQL Editor.
-- Il proprietario della wishlist è escluso anche se per errore compare tra i membri.

create table if not exists public.wishlist_messages (
  id uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references public.wishlists(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  sender_name text not null,
  body text not null check (char_length(trim(body)) between 1 and 1500),
  created_at timestamptz not null default now()
);

create index if not exists wishlist_messages_list_created_idx
  on public.wishlist_messages (wishlist_id, created_at);

alter table public.wishlist_messages enable row level security;

drop policy if exists wishlist_messages_select_participants
  on public.wishlist_messages;
create policy wishlist_messages_select_participants
  on public.wishlist_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.wishlist_members wm
      join public.wishlists w on w.id = wm.wishlist_id
      where wm.wishlist_id = wishlist_messages.wishlist_id
        and wm.user_id = auth.uid()
        and wm.role = 'participant'
        and w.owner_id <> auth.uid()
    )
  );

drop policy if exists wishlist_messages_insert_participants
  on public.wishlist_messages;
create policy wishlist_messages_insert_participants
  on public.wishlist_messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.wishlist_members wm
      join public.wishlists w on w.id = wm.wishlist_id
      where wm.wishlist_id = wishlist_messages.wishlist_id
        and wm.user_id = auth.uid()
        and wm.role = 'participant'
        and w.owner_id <> auth.uid()
    )
  );

grant select, insert on public.wishlist_messages to authenticated;

-- Il nome mostrato nella chat viene preso dal profilo verificato,
-- non da un valore arbitrario inviato dal browser.
create or replace function public.set_wishlist_message_sender_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select coalesce(nullif(trim(p.display_name), ''), 'Partecipante')
    into new.sender_name
  from public.profiles p
  where p.id = new.sender_id;

  if new.sender_name is null then
    new.sender_name := 'Partecipante';
  end if;

  return new;
end;
$$;

drop trigger if exists wishlist_message_sender_name
  on public.wishlist_messages;
create trigger wishlist_message_sender_name
  before insert on public.wishlist_messages
  for each row execute function public.set_wishlist_message_sender_name();

-- Non vengono create policy UPDATE o DELETE: i messaggi inviati restano invariati.
