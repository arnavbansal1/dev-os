# Spec — Database

**Implements:** engineering-doc §7 · FR-13, FR-14, FR-05
**Runnable artifact:** `docs/specs/supabase-schema.sql` (this file is the narrative; the SQL is authoritative)

## Overview

Single Supabase Postgres project. Every table carries `user_id` and has **Row Level Security** so a
user only ever reads/writes their own rows. Custom key terms are **not** a separate table — they are
`key_terms` rows with `is_manual = true` (resolves engineering-doc §15 open item #4). The complete
setup (tables, indexes, triggers, RLS, Storage bucket + policies) is one paste-and-run SQL file.

## Entity relationships

```
auth.users (Supabase-managed)
   │ 1
   ├──< contracts        (user_id)          status: uploaded→processing→complete|error
   │      │ 1
   │      ├──< key_terms       (contract_id, user_id)   is_manual flags custom terms
   │      ├──1 chat_sessions   (contract_id UNIQUE, user_id)
   │      │        │ 1
   │      │        └──< chat_messages (session_id, user_id)  role: user|assistant
   │      └──< user_feedback   (contract_id, user_id)   rating: up|down
```

`ON DELETE CASCADE` everywhere: deleting a contract removes its key terms, chat session, messages,
and feedback; deleting a user (GDPR) cascades to all their data.

## Tables

### `contracts`
One uploaded contract. `contract_text` holds the full extracted text with `[PAGE N]` markers and is
the **single source of truth** for all AI work. `file_path` is nullable — null means the Storage
upload failed and the PDF viewer is hidden (text-viewer fallback still works).

Key columns: `contract_type` (enum NDA|MSA), `page_count` (1–20, checked), `token_count` (0–15000,
checked), `status` (enum), `created_at`/`updated_at`/`last_accessed_at`. `last_accessed_at` drives the
90-day retention job.

### `key_terms`
Standard + custom extracted terms. `value` is the current (possibly edited) value; `ai_original_value`
preserves the model's original for the correction feedback loop; `is_edited` drives the "Edited" badge;
`is_manual = true` marks user-added custom terms; `confidence_score` is `numeric(4,3)` in [0,1];
`source_sentence` is the verbatim grounding sentence; `page_number` is 1-indexed.

### `chat_sessions`
Exactly one per contract (`contract_id` is UNIQUE). Created lazily on first chat message.

### `chat_messages`
Full conversation. `role` enum (user|assistant). Ordered by `created_at` ascending; the chat route
loads up to 200 in ascending order (engineering-doc §8, PRD assumption 14).

### `user_feedback`
Thumbs up/down + optional comment per contract review.

## RLS policies

Every table: `SELECT/INSERT/UPDATE/DELETE` gated on `auth.uid() = user_id`
(`user_feedback` has no UPDATE/DELETE policy — feedback is append-only). `user_id` is **denormalised**
onto `key_terms` and `chat_messages` so each policy is a single equality check (no joins). Server
routes must still set `user_id` explicitly on insert and re-check ownership before writes.

## Storage

Bucket `contracts` (private, 10 MB limit, `application/pdf` only), created via
`insert into storage.buckets`. Object path: `contracts/{user_id}/{contract_id}/{filename}.pdf`.
Three `storage.objects` policies (INSERT/SELECT/DELETE) restrict access to
`auth.uid()::text = (storage.foldername(name))[1]`. The viewer reads via a 1-hour signed URL.

## `term_corrections` view

`select … from key_terms join contracts where is_edited = true`, exposing `ai_original_value` vs
`corrected_value` per term. Powers the 7-day correction-rate alert (> 12% triggers a prompt review).
Inherits the querying user's RLS.

## Indexes

`contracts(user_id)`, `contracts(user_id, created_at desc)` (dashboard sort), `key_terms(contract_id)`,
`key_terms(user_id)`, `chat_sessions(contract_id)`, `chat_messages(session_id, created_at)`,
`user_feedback(contract_id)`.

## Retention & deletion

- **Auto-delete:** a scheduled job removes PDFs (Storage object + `file_path = null`) 90 days after
  `last_accessed_at`. `contract_text` retention follows the same policy for full deletion.
- **User delete:** `DELETE /api/contracts/[id]` removes the Storage object then the `contracts` row
  (cascades to children). See `dashboard.md` and `api-reference.md`.

## Edge cases

- Re-running the SQL is safe (idempotent guards).
- `token_count`/`page_count` CHECK constraints are a backstop; the upload route rejects oversize
  contracts *before* insert with a friendly message (see `pdf-upload-extraction.md`).
- A contract with `status = 'error'` keeps its row so the user can retry `/process` without re-upload.

## Acceptance criteria

- [ ] `supabase-schema.sql` runs clean on a fresh Supabase project with no errors.
- [ ] RLS blocks cross-user access: user A cannot select/update/delete user B's rows in any table (verified by the integration test in `testing-and-eval.md`).
- [ ] Storage policies block a user from reading another user's object path.
- [ ] Deleting a contract cascades to key_terms, chat_sessions, chat_messages, user_feedback.
- [ ] `term_corrections` returns only the caller's edited terms.
