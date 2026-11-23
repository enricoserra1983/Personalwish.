-- PersonalWish: disattiva completamente le funzioni di messaggistica senza cancellare i dati.
-- Eseguire una sola volta nel Supabase SQL Editor del progetto.

do $$
declare
  t text;
  f record;
  n text;
begin
  -- Revoca accesso API alle tabelle della chat attuale e alla vecchia chat delle liste.
  foreach t in array array[
    'chat_conversations',
    'chat_participants',
    'chat_messages',
    'wishlist_messages'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all privileges on table public.%I from anon, authenticated', t);
    end if;
  end loop;

  -- Revoca le RPC di messaggistica, inclusi gli endpoint della vecchia implementazione.
  foreach n in array array[
    'get_my_chats',
    'open_direct_chat',
    'create_group_chat',
    'open_list_chat',
    'mark_chat_read',
    'delete_chat_conversation',
    'get_chat_participant_labels',
    'is_chat_participant',
    'can_read_wishlist_message',
    'can_send_wishlist_message',
    'set_wishlist_chat_creator_mode'
  ] loop
    for f in
      select p.oid::regprocedure as signature
      from pg_proc p
      join pg_namespace s on s.oid = p.pronamespace
      where s.nspname = 'public' and p.proname = n
    loop
      execute format('revoke all privileges on function %s from public, anon, authenticated', f.signature);
    end loop;
  end loop;

  -- Rimuove le tabelle dalla pubblicazione realtime, se presenti.
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime drop table public.chat_messages;
  end if;

  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'wishlist_messages'
  ) then
    alter publication supabase_realtime drop table public.wishlist_messages;
  end if;
end
$$;

-- Le tabelle e i record non vengono eliminati: restano conservati nel database.
-- Le funzionalità di chat non sono più accessibili dai client anonimi o autenticati.
