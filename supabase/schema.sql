-- Bootstrap for a NEW Supabase project only. Do not run over existing tables.
-- No user records, conversations or API keys are included.
begin;

create table public.providers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  title text,
  models jsonb not null default '[]'::jsonb,
  "openAISetting" text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  "idempotentKey" uuid not null default gen_random_uuid() unique,
  visible boolean not null default false,
  unique (user_id, name)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider_id uuid references public.providers(id),
  title text not null,
  selected_model text,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  "idempotentKey" uuid not null default gen_random_uuid()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('question', 'answer')),
  status text not null default 'success' check (status in ('loading', 'streaming', 'success', 'error')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index conversations_user_id_idx on public.conversations(user_id);
create index conversations_provider_id_idx on public.conversations(provider_id);
create index messages_user_id_idx on public.messages(user_id);
create index messages_conversation_id_idx on public.messages(conversation_id);

alter table public.providers enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.providers, public.conversations, public.messages to authenticated;

create policy providers_owner on public.providers for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy conversations_owner on public.conversations for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy messages_owner on public.messages for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

commit;
