-- Rimuove un'amicizia in modo sicuro per l'utente autenticato.
create or replace function public.remove_friend(p_friend_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Devi aver effettuato l’accesso';
  end if;
  if p_friend_id is null or p_friend_id = v_user_id then
    raise exception 'Amico non valido';
  end if;

  delete from public.friendships
  where (user_low = least(v_user_id, p_friend_id)
     and user_high = greatest(v_user_id, p_friend_id));

  if not found then
    raise exception 'Questa persona non risulta tra i tuoi amici';
  end if;
end;
$$;

revoke all on function public.remove_friend(uuid) from public;
grant execute on function public.remove_friend(uuid) to authenticated;
