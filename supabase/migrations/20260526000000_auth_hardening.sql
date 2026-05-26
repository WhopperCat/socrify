-- Auth hardening:
--  1. Explicit INSERT denial on profiles (anon/auth can never create rows;
--     handle_new_user runs as security definer and bypasses RLS).
--  2. Trigger guard so anon/auth roles cannot flip profiles.is_dev (which
--     bypasses every rate-limit gate); service role still can.
--  3. Identity constraint on usage_logs so every log row references either
--     a real user or a hashed guest IP.
--  4. Email sync trigger so profiles.email stays in sync with auth.users.email
--     when a user changes their address via Supabase Auth.

/* ---------- profiles: explicit INSERT denial ----------
   Drop any owner-INSERT policy that may exist from an earlier initial-schema
   migration; the handle_new_user trigger (security definer) is the only
   intended writer, and it bypasses RLS. */
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_no_insert" on public.profiles;
create policy "profiles_no_insert" on public.profiles
  for insert with check (false);

/* ---------- profiles.is_dev immutability ----------
   The owner-UPDATE policy doesn't restrict columns, so without this guard a
   signed-in user could self-promote to is_dev and bypass every rate-limit
   gate. Service role still flips it for ops use. */
create or replace function public.guard_profiles_is_dev()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon')
     and new.is_dev is distinct from old.is_dev then
    raise exception 'profiles.is_dev is read-only for this role';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profiles_is_dev on public.profiles;
create trigger guard_profiles_is_dev
  before update on public.profiles
  for each row execute function public.guard_profiles_is_dev();

/* ---------- usage_logs: enforce identity ---------- */
alter table public.usage_logs
  drop constraint if exists usage_logs_identity_required;
alter table public.usage_logs
  add constraint usage_logs_identity_required
  check (user_id is not null or ip_hash is not null);

/* ---------- auth.users.email → profiles.email sync ---------- */
create or replace function public.handle_user_email_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
       set email      = new.email,
           updated_at = now()
     where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.handle_user_email_update();
