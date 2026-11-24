-- PersonalWish: attivazione RLS sulle tabelle dei gruppi principali.
-- Le policy sono già definite in supabase/rls_policies.sql.
-- Questa migrazione le rende effettive attivando Row Level Security.

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_wishlists enable row level security;
