-- Fix RLS recursion in PersonalWish chat participant policies.
-- Run this script once in Supabase SQL Editor.

create or replace function public.is_chat_participant(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.chat_participants p
    where p.conversation_id = p_conversation_id
      and p.user_id = auth.uid()
  );
$$;

revoke all on function public.is_chat_participant(uuid) from public;
grant execute on function public.is_chat_participant(uuid) to authenticated;

drop policy if exists chat_conversations_read_member on public.chat_conversations;
create policy chat_conversations_read_member
on public.chat_conversations
for select to authenticated
using (public.is_chat_participant(id));

drop policy if exists chat_participants_read_member on public.chat_participants;
create policy chat_participants_read_member
on public.chat_participants
for select to authenticated
using (public.is_chat_participant(conversation_id));

drop policy if exists chat_messages_read_member on public.chat_messages;
create policy chat_messages_read_member
on public.chat_messages
for select to authenticated
using (public.is_chat_participant(conversation_id));

drop policy if exists chat_messages_send_member on public.chat_messages;
create policy chat_messages_send_member
on public.chat_messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and public.is_chat_participant(conversation_id)
);

-- Enable realtime delivery for new chat messages (safe to run more than once).
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end
$$;
