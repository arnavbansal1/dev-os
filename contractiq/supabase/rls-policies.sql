-- ============================================================================
-- ContractIQ — security hardening migration
-- Run this in the Supabase SQL Editor. Safe to re-run (fully idempotent).
--
-- Covers:
--   1. rate_limit_events        — durable sliding-window rate limiting
--   2. RLS enable (all tables)  — re-asserted defensively
--   3. Ownership policies       — re-asserted to match the application's checks
--   4. Storage bucket           — private + PDF-only + size-capped
--   5. term_corrections view    — close the RLS bypass on the view
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Rate limiting
--
--    Keyed by an opaque `identifier` rather than a user_id FK, because the login
--    limiter runs BEFORE a user exists and keys on a hashed client IP.
--    Written and read exclusively by the service role — no user-facing policy.
-- ----------------------------------------------------------------------------
create table if not exists public.rate_limit_events (
  id         uuid        primary key default gen_random_uuid(),
  identifier text        not null,
  action     text        not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rate_limit_events_lookup
  on public.rate_limit_events (identifier, action, created_at desc);

alter table public.rate_limit_events enable row level security;

-- RLS is enabled with NO policies: with RLS on and no policy, anon/authenticated
-- roles are denied everything while the service role bypasses RLS entirely.
-- This is what stops a user from deleting their own counter rows.
revoke all on public.rate_limit_events from anon, authenticated;

-- Housekeeping: drop counters older than the longest window (24h) plus slack.
create or replace function public.prune_rate_limit_events()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rate_limit_events
  where created_at < now() - interval '48 hours';
$$;

-- ----------------------------------------------------------------------------
-- 2. Enable RLS on every application table (idempotent)
-- ----------------------------------------------------------------------------
alter table public.contracts     enable row level security;
alter table public.key_terms     enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.user_feedback enable row level security;

-- Force RLS even for the table owner, so a future trigger or definer function
-- running as owner cannot silently read across tenants.
alter table public.contracts     force row level security;
alter table public.key_terms     force row level security;
alter table public.chat_sessions force row level security;
alter table public.chat_messages force row level security;
alter table public.user_feedback force row level security;

-- ----------------------------------------------------------------------------
-- 3. Own-data-only policies (auth.uid() = user_id)
-- ----------------------------------------------------------------------------

-- contracts
drop policy if exists "contracts_select_own" on public.contracts;
create policy "contracts_select_own" on public.contracts
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "contracts_insert_own" on public.contracts;
create policy "contracts_insert_own" on public.contracts
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "contracts_update_own" on public.contracts;
create policy "contracts_update_own" on public.contracts
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "contracts_delete_own" on public.contracts;
create policy "contracts_delete_own" on public.contracts
  for delete to authenticated using (auth.uid() = user_id);

-- key_terms
drop policy if exists "key_terms_select_own" on public.key_terms;
create policy "key_terms_select_own" on public.key_terms
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "key_terms_insert_own" on public.key_terms;
create policy "key_terms_insert_own" on public.key_terms
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "key_terms_update_own" on public.key_terms;
create policy "key_terms_update_own" on public.key_terms
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "key_terms_delete_own" on public.key_terms;
create policy "key_terms_delete_own" on public.key_terms
  for delete to authenticated using (auth.uid() = user_id);

-- chat_sessions
drop policy if exists "chat_sessions_select_own" on public.chat_sessions;
create policy "chat_sessions_select_own" on public.chat_sessions
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "chat_sessions_insert_own" on public.chat_sessions;
create policy "chat_sessions_insert_own" on public.chat_sessions
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "chat_sessions_delete_own" on public.chat_sessions;
create policy "chat_sessions_delete_own" on public.chat_sessions
  for delete to authenticated using (auth.uid() = user_id);

-- chat_messages
drop policy if exists "chat_messages_select_own" on public.chat_messages;
create policy "chat_messages_select_own" on public.chat_messages
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "chat_messages_insert_own" on public.chat_messages;
create policy "chat_messages_insert_own" on public.chat_messages
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "chat_messages_delete_own" on public.chat_messages;
create policy "chat_messages_delete_own" on public.chat_messages
  for delete to authenticated using (auth.uid() = user_id);

-- user_feedback
drop policy if exists "user_feedback_select_own" on public.user_feedback;
create policy "user_feedback_select_own" on public.user_feedback
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "user_feedback_insert_own" on public.user_feedback;
create policy "user_feedback_insert_own" on public.user_feedback
  for insert to authenticated with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 4. Storage — private bucket, PDF-only, 10 MB cap
--    `public = false` is what forces every read through a signed URL.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contracts', 'contracts', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public             = false,
      file_size_limit    = 10485760,
      allowed_mime_types = array['application/pdf'];

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
-- 5. term_corrections view
--
--    Views run with the privileges of their OWNER, so a view over an RLS-
--    protected table bypasses that RLS unless it is declared security_invoker.
--    Without this, any authenticated user selecting from term_corrections reads
--    every user's extracted contract values.
--    (security_invoker requires Postgres 15+, which Supabase projects run.)
-- ----------------------------------------------------------------------------
alter view if exists public.term_corrections set (security_invoker = on);

revoke all on public.term_corrections from anon;
grant select on public.term_corrections to authenticated;
