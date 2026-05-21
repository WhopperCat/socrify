-- Subscriptions, profiles, and server-side usage tracking
-- Pairs with functions/chat.js (was already querying usage_logs + profiles)

/* ---------- profiles ---------- */
create table if not exists public.profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  first_name  text,
  email       text,
  is_dev      boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_owner_select" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_owner_update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

/* ---------- subscriptions ---------- */
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

-- Read-only for the owner; service role writes (handles tier flips + future Stripe webhooks)
create policy "subscriptions_owner_select" on public.subscriptions
  for select using (auth.uid() = user_id);

/* ---------- usage_logs ---------- */
create table if not exists public.usage_logs (
  id              bigint      generated always as identity primary key,
  user_id         uuid        references auth.users(id) on delete cascade,
  ip_hash         text,
  event_type      text        not null check (event_type in ('ai_call','session_start')),
  mode            text        check (mode in ('tutor','research')),
  subject         text,
  conversation_id text,
  created_at      timestamptz not null default now()
);

create index if not exists usage_logs_user_event_created
  on public.usage_logs (user_id, event_type, created_at desc);

create index if not exists usage_logs_ip_event_created
  on public.usage_logs (ip_hash, event_type, created_at desc);

-- RLS on with no policies = deny all from anon/auth roles.
-- The chat function uses the service role key, which bypasses RLS.
alter table public.usage_logs enable row level security;

/* ---------- auto-create profile + free subscription on signup ---------- */
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', null)
  )
  on conflict (id) do nothing;

  insert into public.subscriptions (user_id, tier, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
