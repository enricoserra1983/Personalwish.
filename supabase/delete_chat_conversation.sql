-- PersonalWish: elimina una conversazione e i relativi messaggi per tutti i partecipanti.
create or replace function public.delete_chat_conversation(p_conversation_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public
set row_security=off
as $$
begin
  if auth.uid() is null then
    raise exception 'Devi accedere';
  end if;
  if not exists (
    select 1 from public.chat_participants
    where conversation_id=p_conversation_id and user_id=auth.uid()
  ) then
    raise exception 'Non sei autorizzato a eliminare questa conversazione';
  end if;
  delete from public.chat_conversations where id=p_conversation_id;
  if not found then
    raise exception 'Conversazione non trovata';
  end if;
  return true;
end;
$$;
revoke all on function public.delete_chat_conversation(uuid) from public;
grant execute on function public.delete_chat_conversation(uuid) to authenticated;
