-- ============================================================================
-- ContractIQ — Supabase schema (paste-and-run)
-- Source of truth: docs/engineering/engineering-doc.md §7
--
-- HOW TO RUN
--   Supabase Dashboard → SQL Editor → New query → paste this entire file → Run.
--   Safe to run once on a fresh project. Idempotent guards (IF NOT EXISTS /
--   DROP POLICY IF EXISTS) let you re-run during development.
--
-- DESIGN NOTES
--   * Custom key terms are modelled as rows in `key_terms` with is_manual = true
--     (resolves engineering-doc §15 open item #4 — single table, not a separate one).
--   * Every table carries user_id and has RLS so a user only ever sees their own rows.
--   * PDF text is the single source of truth (contracts.contract_text); Storage is
--     optional/non-blocking and only feeds the PDF viewer.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Extensions
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto;      -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- 1. Enums
-- ----------------------------------------------------------------------------
do $$ begin
  create type contract_type as enum ('NDA', 'MSA');
exception when duplicate_object then null; end $$;

do $$ begin
  create type contract_status as enum ('uploaded', 'processing', 'complete', 'error');
exception when duplicate_object then null; end $$;

do $$ begin
  create type chat_role as enum ('user', 'assistant');
exception when duplicate_object then null; end $$;

do $$ begin
  create type feedback_rating as enum ('up', 'down');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- 2. Shared trigger — auto-update updated_at
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ----------------------------------------------------------------------------
-- 3. Tables (dependency order)
-- ----------------------------------------------------------------------------

-- 3.1 contracts ---------------------------------------------------------------
create table if not exists public.contracts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  name             text not null,
  contract_type    contract_type not null,
  contract_text    text not null,                      -- full text with [PAGE N] markers
  page_count       integer not null check (page_count between 1 and 20),
  token_count      integer not null check (token_count >= 0 and token_count <= 15000),
  file_path        text,                               -- null when Storage upload failed
  status           contract_status not null default 'uploaded',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  last_accessed_at timestamptz not null default now()
);

-- 3.2 key_terms ---------------------------------------------------------------
create table if not exists public.key_terms (
  id                uuid primary key default gen_random_uuid(),
  contract_id       uuid not null references public.contracts (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,
  term_name         text not null,
  value             text not null default '',
  ai_original_value text not null default '',          -- preserved for the feedback loop
  page_number       integer check (page_number >= 1),
  confidence_score  numeric(4,3) check (confidence_score >= 0 and confidence_score <= 1),
  source_sentence   text not null default '',
  is_edited         boolean not null default false,
  is_manual         boolean not null default false,    -- true = user-added custom term
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 3.3 chat_sessions -----------------------------------------------------------
create table if not exists public.chat_sessions (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null unique references public.contracts (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- 3.4 chat_messages -----------------------------------------------------------
create table if not exists public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       chat_role not null,
  content    text not null,
  -- Conversation memory layer: where an assistant answer was sourced from.
  -- Null for user turns and any rows written before this column existed.
  source     text check (source in ('contract', 'history', 'both')),
  created_at timestamptz not null default now()
);

-- 3.5 user_feedback -----------------------------------------------------------
create table if not exists public.user_feedback (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  rating      feedback_rating not null,
  comment     text,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. Indexes
-- ----------------------------------------------------------------------------
create index if not exists idx_contracts_user            on public.contracts (user_id);
create index if not exists idx_contracts_user_created    on public.contracts (user_id, created_at desc);
create index if not exists idx_key_terms_contract        on public.key_terms (contract_id);
create index if not exists idx_key_terms_user            on public.key_terms (user_id);
create index if not exists idx_chat_sessions_contract    on public.chat_sessions (contract_id);
create index if not exists idx_chat_messages_session     on public.chat_messages (session_id, created_at);
create index if not exists idx_user_feedback_contract    on public.user_feedback (contract_id);

-- ----------------------------------------------------------------------------
-- 5. updated_at triggers (tables that have the column)
-- ----------------------------------------------------------------------------
drop trigger if exists trg_contracts_updated_at on public.contracts;
create trigger trg_contracts_updated_at
  before update on public.contracts
  for each row execute function set_updated_at();

drop trigger if exists trg_key_terms_updated_at on public.key_terms;
create trigger trg_key_terms_updated_at
  before update on public.key_terms
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 6. Row Level Security — enable + policies (own-data-only, user_id = auth.uid())
-- ----------------------------------------------------------------------------
alter table public.contracts     enable row level security;
alter table public.key_terms     enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.user_feedback enable row level security;

-- contracts
drop policy if exists "contracts_select_own" on public.contracts;
create policy "contracts_select_own" on public.contracts
  for select using (auth.uid() = user_id);
drop policy if exists "contracts_insert_own" on public.contracts;
create policy "contracts_insert_own" on public.contracts
  for insert with check (auth.uid() = user_id);
drop policy if exists "contracts_update_own" on public.contracts;
create policy "contracts_update_own" on public.contracts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "contracts_delete_own" on public.contracts;
create policy "contracts_delete_own" on public.contracts
  for delete using (auth.uid() = user_id);

-- key_terms
drop policy if exists "key_terms_select_own" on public.key_terms;
create policy "key_terms_select_own" on public.key_terms
  for select using (auth.uid() = user_id);
drop policy if exists "key_terms_insert_own" on public.key_terms;
create policy "key_terms_insert_own" on public.key_terms
  for insert with check (auth.uid() = user_id);
drop policy if exists "key_terms_update_own" on public.key_terms;
create policy "key_terms_update_own" on public.key_terms
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "key_terms_delete_own" on public.key_terms;
create policy "key_terms_delete_own" on public.key_terms
  for delete using (auth.uid() = user_id);

-- chat_sessions
drop policy if exists "chat_sessions_select_own" on public.chat_sessions;
create policy "chat_sessions_select_own" on public.chat_sessions
  for select using (auth.uid() = user_id);
drop policy if exists "chat_sessions_insert_own" on public.chat_sessions;
create policy "chat_sessions_insert_own" on public.chat_sessions
  for insert with check (auth.uid() = user_id);
drop policy if exists "chat_sessions_delete_own" on public.chat_sessions;
create policy "chat_sessions_delete_own" on public.chat_sessions
  for delete using (auth.uid() = user_id);

-- chat_messages
drop policy if exists "chat_messages_select_own" on public.chat_messages;
create policy "chat_messages_select_own" on public.chat_messages
  for select using (auth.uid() = user_id);
drop policy if exists "chat_messages_insert_own" on public.chat_messages;
create policy "chat_messages_insert_own" on public.chat_messages
  for insert with check (auth.uid() = user_id);
drop policy if exists "chat_messages_delete_own" on public.chat_messages;
create policy "chat_messages_delete_own" on public.chat_messages
  for delete using (auth.uid() = user_id);

-- user_feedback
drop policy if exists "user_feedback_select_own" on public.user_feedback;
create policy "user_feedback_select_own" on public.user_feedback
  for select using (auth.uid() = user_id);
drop policy if exists "user_feedback_insert_own" on public.user_feedback;
create policy "user_feedback_insert_own" on public.user_feedback
  for insert with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 7. Storage — contracts bucket + policies
--    Path pattern: contracts/{user_id}/{contract_id}/{filename}.pdf
--    (storage.foldername(name))[1] = the {user_id} segment.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contracts', 'contracts', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists "contracts_storage_insert_own" on storage.objects;
create policy "contracts_storage_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'contracts' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "contracts_storage_select_own" on storage.objects;
create policy "contracts_storage_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'contracts' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "contracts_storage_delete_own" on storage.objects;
create policy "contracts_storage_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'contracts' and auth.uid()::text = (storage.foldername(name))[1]);

-- ----------------------------------------------------------------------------
-- 8. term_corrections view — powers the prompt-improvement feedback loop
--    (edited terms only; exposes AI original vs corrected value).
-- ----------------------------------------------------------------------------
create or replace view public.term_corrections as
  select
    kt.id,
    kt.user_id,
    kt.contract_id,
    c.contract_type,
    kt.term_name,
    kt.ai_original_value,
    kt.value        as corrected_value,
    kt.confidence_score,
    kt.updated_at   as corrected_at
  from public.key_terms kt
  join public.contracts c on c.id = kt.contract_id
  where kt.is_edited = true;

-- IMPORTANT: views do NOT default to security_invoker — Postgres runs a view with
-- the privileges of its OWNER, which bypasses RLS on key_terms/contracts entirely.
-- Without the line below, any authenticated user selecting from this view reads
-- every user's extracted contract values. (Requires Postgres 15+; Supabase is 15+.)
alter view public.term_corrections set (security_invoker = on);

revoke all on public.term_corrections from anon;
grant select on public.term_corrections to authenticated;

-- ============================================================================
-- End of schema.
-- ============================================================================
