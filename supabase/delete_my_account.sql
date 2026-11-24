-- PersonalWish: eliminazione definitiva dell'account da parte del proprietario.
-- Eseguire una sola volta nell'SQL Editor del progetto Supabase.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth, storage
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Devi aver effettuato l''accesso per eliminare l''account.';
  end if;

  -- Rimuove le immagini caricate dall'utente nel bucket privato/pubblico dell'app.
  delete from storage.objects
  where bucket_id = 'wishlist-images'
    and name like v_user_id::text || '/%';

  -- La cancellazione dell'utente Auth attiva le FK ON DELETE CASCADE
  -- definite nello schema PersonalWish per profilo, liste e dati collegati.
  delete from auth.users
  where id = v_user_id;

  if not found then
    raise exception 'Account non trovato.';
  end if;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
