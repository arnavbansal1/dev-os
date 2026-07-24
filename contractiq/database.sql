-- Migration: Conversation Memory Layer — assistant answer attribution
-- Run this in the Supabase SQL Editor against an existing database.
-- (New databases created from docs/specs/supabase-schema.sql already include it.)
--
-- Adds a nullable `source` column recording where each assistant answer came from:
--   'contract' | 'history' | 'both'
-- Null for user turns and any rows written before this migration.

alter table public.chat_messages
  add column if not exists source text
  check (source in ('contract', 'history', 'both'));
