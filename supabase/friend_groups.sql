-- PersonalWish: rubriche personalizzate all'interno di Amici.
create table if not exists public.friend_groups (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 name text not null check (length(trim(name)) between 1 and 40),
 created_at timestamptz not null default now(),
 unique(owner_id,name)
);
create table if not exists public.friend_group_members (
 group_id uuid not null references public.friend_groups(id) on delete cascade,
 friend_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(group_id,friend_id)
);
create table if not exists public.wishlist_friend_groups (
 wishlist_id uuid not null references public.wishlists(id) on delete cascade,
 group_id uuid not null references public.friend_groups(id) on delete cascade,
 primary key(wishlist_id,group_id)
);
alter table public.friend_groups enable row level security;
alter table public.friend_group_members enable row level security;
alter table public.wishlist_friend_groups enable row level security;
grant select on public.friend_groups,public.friend_group_members,public.wishlist_friend_groups to authenticated;

create or replace function public.get_my_friend_groups()
returns table(group_id uuid, group_name text, member_count bigint)
language sql stable security definer set search_path=public set row_security=off
as $$
 select g.id,g.name,count(m.friend_id)
 from public.friend_groups g left join public.friend_group_members m on m.group_id=g.id
 where g.owner_id=auth.uid() group by g.id,g.name order by g.name;
$$;

create or replace function public.get_friend_group_members(p_group_id uuid)
returns table(user_id uuid,display_name text)
language sql stable security definer set search_path=public set row_security=off
as $$
 select p.id,p.display_name from public.friend_group_members gm
 join public.friend_groups g on g.id=gm.group_id
 join public.profiles p on p.id=gm.friend_id
 where g.owner_id=auth.uid() and g.id=p_group_id order by p.display_name;
$$;

create or replace function public.save_friend_group(p_name text,p_group_id uuid default null)
returns uuid
language plpgsql security definer set search_path=public set row_security=off
as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'Devi accedere'; end if;
 if length(trim(coalesce(p_name,'')))=0 or length(trim(p_name))>40 then raise exception 'Nome gruppo non valido'; end if;
 if p_group_id is null then
  insert into public.friend_groups(owner_id,name) values(auth.uid(),trim(p_name)) returning id into v_id;
 else
  update public.friend_groups set name=trim(p_name) where id=p_group_id and owner_id=auth.uid() returning id into v_id;
  if v_id is null then raise exception 'Gruppo non trovato'; end if;
 end if;
 return v_id;
end;
$$;

create or replace function public.set_friend_group_member(p_group_id uuid,p_friend_id uuid,p_add boolean)
returns boolean
language plpgsql security definer set search_path=public set row_security=off
as $$
declare v_low uuid; v_high uuid;
begin
 if auth.uid() is null then raise exception 'Devi accedere'; end if;
 if not exists(select 1 from public.friend_groups where id=p_group_id and owner_id=auth.uid()) then raise exception 'Gruppo non trovato'; end if;
 v_low:=least(auth.uid(),p_friend_id); v_high:=greatest(auth.uid(),p_friend_id);
 if not exists(select 1 from public.friendships where user_low=v_low and user_high=v_high) then raise exception 'Puoi aggiungere soltanto un tuo amico'; end if;
 if p_add then insert into public.friend_group_members(group_id,friend_id) values(p_group_id,p_friend_id) on conflict do nothing;
 else delete from public.friend_group_members where group_id=p_group_id and friend_id=p_friend_id;
 end if;
 return true;
end;
$$;

create or replace function public.delete_friend_group(p_group_id uuid)
returns boolean
language plpgsql security definer set search_path=public set row_security=off
as $$
begin
 delete from public.friend_groups where id=p_group_id and owner_id=auth.uid();
 if not found then raise exception 'Gruppo non trovato'; end if;
 return true;
end;
$$;

revoke all on function public.get_my_friend_groups() from public;
revoke all on function public.get_friend_group_members(uuid) from public;
revoke all on function public.save_friend_group(text,uuid) from public;
revoke all on function public.set_friend_group_member(uuid,uuid,boolean) from public;
revoke all on function public.delete_friend_group(uuid) from public;
grant execute on function public.get_my_friend_groups(),public.get_friend_group_members(uuid),
 public.save_friend_group(text,uuid),public.set_friend_group_member(uuid,uuid,boolean),
 public.delete_friend_group(uuid) to authenticated;
