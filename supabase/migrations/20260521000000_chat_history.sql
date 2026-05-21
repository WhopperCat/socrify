-- Chat history tables for Socrify
-- Guests use localStorage; auth'd users sync here via POST /history

create table if not exists public.conversations (
  id            text        primary key,           -- client-generated: conv_<timestamp>_<random>
  user_id       uuid        not null references auth.users on delete cascade,
  subject_id    text        not null,
  subject_label text        not null,
  mode          text        not null check (mode in ('tutor', 'research')),
  title         text        not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.messages (
  id              bigint      generated always as identity primary key,
  conversation_id text        not null references public.conversations on delete cascade,
  role            text        not null check (role in ('user', 'assistant')),
  content         text        not null,
  citations       jsonb       null,
  sort_order      int         not null default 0,
  created_at      timestamptz not null default now()
);

-- Indexes
create index if not exists conversations_user_id_created_at
  on public.conversations (user_id, created_at desc);

create index if not exists messages_conversation_id_sort
  on public.messages (conversation_id, sort_order);

-- RLS: users may only read/write their own conversations
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

create policy "owner_all_conversations" on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner_all_messages" on public.messages
  for all using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.user_id = auth.uid()
    )
  );
