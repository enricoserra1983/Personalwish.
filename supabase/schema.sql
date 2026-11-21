-- PersonalWish initial database model (Supabase / PostgreSQL)
-- Apply only after creating a Supabase project and reviewing policies.

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  share_token text not null unique default encode(gen_random_bytes(18), 'hex'),
  is_public boolean not null default false,
  -- Independent visibility settings for each wishlist.
  owner_sees_participants boolean not null default true,
  participants_see_participants boolean not null default true,
  owner_sees_reservations boolean not null default false,
  participants_see_reservations boolean not null default true,
  owner_sees_buyer boolean not null default false,
  participants_see_buyer boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not owner_sees_buyer or owner_sees_reservations),
  check (not participants_see_buyer or participants_see_reservations)
);

create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references public.wishlists(id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  product_url text,
  price numeric(10,2),
  currency text not null default 'EUR',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.wishlist_members (
  wishlist_id uuid not null references public.wishlists(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'participant' check (role in ('owner','participant')),
  joined_at timestamptz not null default now(),
  primary key (wishlist_id, user_id)
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.wishlist_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'reserved' check (status in ('reserved','purchased','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, user_id)
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  invite_code text not null unique default encode(gen_random_bytes(8), 'hex'),
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.group_wishlists (
  group_id uuid not null references public.groups(id) on delete cascade,
  wishlist_id uuid not null references public.wishlists(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (group_id, wishlist_id)
);

-- IMPORTANT SECURITY TODO:
-- Do not expose reservations directly through a broad SELECT policy.
-- Implement a server-side RPC/view that returns only the fields allowed by
-- the wishlist's visibility settings and the requesting user's role.
-- Public share-token access must return wishlist + item data only, never
-- member identities or reservation rows.
-- Add RLS policies for every table before production deployment.
