-- Reconciles the live production schema with what src/auth.jsx and
-- functions/chat.js expect. The earlier migrations 20260522 (subscriptions
-- + auth-aware handle_new_user) and 20260526 (auth hardening) were never
-- applied against the project's actual baseline, which still carries the
-- initial-schema's `profiles` shape (username UNIQUE, no email column) and
-- a `handle_new_user` trigger that crashes on duplicate email local-parts.
-- This migration is additive and idempotent against that live state.

------------------------------------------------------------------
-- 1. profiles: add the missing `email` column and backfill from auth.users
------------------------------------------------------------------
alter table public.profiles
  add column if not exists email text;

update public.profiles p
   set email = u.email
  from auth.users u
 where p.id = u.id
   and p.email is distinct from u.email;

------------------------------------------------------------------
-- 2. profiles policies: drop the owner-INSERT policy (security hole),
--    keep owner select/update. The handle_new_user trigger runs as
--    SECURITY DEFINER so it doesn't need an INSERT policy.
------------------------------------------------------------------
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_no_insert"  on public.profiles;
create policy "profiles_no_insert" on public.profiles
  for insert with check (false);

------------------------------------------------------------------
-- 3. Guard is_dev so authenticated users can't self-promote past the
--    rate-limit gates. Service role still flips it for ops use.
------------------------------------------------------------------
create or replace function public.guard_profiles_is_dev()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated','anon')
     and new.is_dev is distinct from old.is_dev then
    raise exception 'profiles.is_dev is read-only for this role';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_profiles_is_dev() from public, anon, authenticated;

drop trigger if exists guard_profiles_is_dev on public.profiles;
create trigger guard_profiles_is_dev
  before update on public.profiles
  for each row execute function public.guard_profiles_is_dev();

------------------------------------------------------------------
-- 4. subscriptions table (was missing entirely in production)
------------------------------------------------------------------
create table if not exists public.subscriptions (
  user_id                uuid        primary key references auth.users(id) on delete cascade,
  tier                   text        not null default 'free' check (tier in ('free','pro')),
  status                 text        not null default 'active' check (status in ('active','canceled','past_due')),
  stripe_customer_id     text,
  stripe_subscription_id text,
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_owner_select" on public.subscriptions;
create policy "subscriptions_owner_select" on public.subscriptions
  for select using (auth.uid() = user_id);

-- Backfill a free subscription for every existing auth user so tier
-- resolution returns 'free' rather than 'guest' for pre-migration accounts.
insert into public.subscriptions (user_id, tier, status)
select id, 'free', 'active' from auth.users
on conflict (user_id) do nothing;

------------------------------------------------------------------
-- 5. usage_logs: add `conversation_id` (chat.js logs it on session_start)
--    and require either user_id or ip_hash so no fully-anonymous rows leak in.
------------------------------------------------------------------
alter table public.usage_logs
  add column if not exists conversation_id text;

alter table public.usage_logs
  drop constraint if exists usage_logs_identity_required;
alter table public.usage_logs
  add constraint usage_logs_identity_required
  check (user_id is not null or ip_hash is not null);

------------------------------------------------------------------
-- 6. Replace handle_new_user with a version that:
--      - generates a UNIQUE username (the old version crashed on
--        duplicate email local-parts because ON CONFLICT only handled id),
--      - writes the email/first_name columns the frontend expects,
--      - creates the free subscriptions row alongside the profile.
------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base      text;
  v_username  text;
  v_attempt   int := 0;
begin
  v_base := coalesce(
    nullif(new.raw_user_meta_data->>'username',''),
    split_part(new.email,'@',1),
    'user'
  );
  v_username := v_base;
  while exists (select 1 from public.profiles where username = v_username) loop
    v_attempt := v_attempt + 1;
    v_username := v_base || v_attempt::text;
  end loop;

  insert into public.profiles (id, email, first_name, username)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'first_name',''),
    v_username
  )
  on conflict (id) do nothing;

  insert into public.subscriptions (user_id, tier, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- The advisor flagged this SECURITY DEFINER function as RPC-exposed.
-- It's only meant to run as an auth.users trigger. Default grants on a new
-- function include PUBLIC EXECUTE, so revoke that too — anon/authenticated
-- inherit from PUBLIC, so revoking those alone isn't enough.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

------------------------------------------------------------------
-- 7. Keep profiles.email in sync when auth.users.email changes
------------------------------------------------------------------
create or replace function public.handle_user_email_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
       set email = new.email,
           updated_at = now()
     where id = new.id;
  end if;
  return new;
end;
$$;

revoke execute on function public.handle_user_email_update() from public, anon, authenticated;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.handle_user_email_update();

------------------------------------------------------------------
-- 8. Pin touch_updated_at search_path (security advisor warning)
------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
