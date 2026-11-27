-- MyPersonalWish: controllo server-side della maggiore eta in fase di registrazione.
-- Eseguire una sola volta nel Supabase SQL Editor.
-- La data di nascita viene usata per il controllo e rimossa dai metadati Auth,
-- così questa procedura non la conserva nel profilo o nei metadati dell'account.

create or replace function public.enforce_adult_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_birth_date date;
begin
  if new.raw_user_meta_data ->> 'birth_date_for_age_check' is null then
    raise exception 'Per registrarti devi dichiarare e verificare di avere almeno 18 anni.';
  end if;

  begin
    v_birth_date := (new.raw_user_meta_data ->> 'birth_date_for_age_check')::date;
  exception when others then
    raise exception 'Data di nascita non valida.';
  end;

  if v_birth_date > (current_date - interval '18 years')::date then
    raise exception 'La registrazione a MyPersonalWish è riservata a chi ha compiuto 18 anni.';
  end if;

  new.raw_user_meta_data := new.raw_user_meta_data - 'birth_date_for_age_check';
  return new;
end;
$$;

drop trigger if exists enforce_adult_signup_before_insert on auth.users;

create trigger enforce_adult_signup_before_insert
before insert on auth.users
for each row
execute function public.enforce_adult_signup();

revoke all on function public.enforce_adult_signup() from public, anon, authenticated;
