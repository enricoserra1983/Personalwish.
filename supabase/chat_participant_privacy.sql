-- PersonalWish: nomi dei mittenti rispettosi delle amicizie nella stessa chat.
-- In chat di gruppo/lista ogni partecipante vede il nome reale solo dei propri amici.
create or replace function public.get_chat_participant_labels(p_conversation_id uuid)
returns table(user_id uuid, display_label text)
language plpgsql
stable
security definer
set search_path=public
set row_security=off
as $$
declare
  v_type text;
begin
  if auth.uid() is null then
    raise exception 'Devi accedere';
  end if;

  select c.type into v_type
  from public.chat_conversations c
  join public.chat_participants me
    on me.conversation_id=c.id and me.user_id=auth.uid()
  where c.id=p_conversation_id;

  if not found then
    raise exception 'Non sei un partecipante a questa conversazione';
  end if;

  return query
  select
    p.user_id,
    case
      when p.user_id=auth.uid() then 'Tu'
      when v_type='direct' then coalesce(nullif(trim(pr.display_name),''),'Utente')
      when exists (
        select 1
        from public.friendships f
        where f.user_low=least(auth.uid(),p.user_id)
          and f.user_high=greatest(auth.uid(),p.user_id)
      ) then coalesce(nullif(trim(pr.display_name),''),'Amico')
      else 'Utente ' || upper(substr(replace(p.user_id::text,'-',''),1,6))
    end
  from public.chat_participants p
  join public.profiles pr on pr.id=p.user_id
  where p.conversation_id=p_conversation_id;
end;
$$;

revoke all on function public.get_chat_participant_labels(uuid) from public;
grant execute on function public.get_chat_participant_labels(uuid) to authenticated;
