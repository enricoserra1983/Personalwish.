-- PersonalWish: dati estesi del profilo e privacy del compleanno
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists birth_date date,
  add column if not exists birthday_visible boolean not null default false;

-- L'avatar_url esiste già nello schema iniziale.
