# ContractIQ — Implementation Specs

Granular, buildable specs derived from `docs/engineering/engineering-doc.md`. Each file is
self-contained: a developer can implement it end-to-end without reading the others. Read this index
first, then build in the order below.

## Files

| File | What it specifies |
|---|---|
| `supabase-schema.sql` | **Paste-and-run** SQL: enums, 5 tables, indexes, `updated_at` triggers, RLS policies, Storage bucket + policies, `term_corrections` view |
| `database.md` | Schema narrative — tables, relationships, RLS rationale, retention, Storage paths |
| `auth.md` | Supabase email/password auth, session, middleware route protection, Supabase clients (US-001, FR-01) |
| `pdf-upload-extraction.md` | Upload route, `pdf-parse` text extraction with `[PAGE N]`, validation, non-blocking Storage (US-002, FR-02/03) |
| `key-term-extraction.md` | Process route, GPT-4o JSON extraction, prompts + term libraries, confidence, custom terms, retries (US-003/004/005/011p, FR-04/05/11) |
| `results-and-viewer.md` | Results page, PDF.js viewer + text fallback, page navigation, inline edit, "Why?", disclaimer (US-006/009/011p, FR-06/07) |
| `contract-chat.md` | Chat route, full-context grounding, query classification, history, page citation, persistence (US-007/012, FR-08/09) |
| `dashboard.md` | Contract history, summary, sortable list, contract delete/GDPR (US-008, FR-10) |
| `feedback.md` | Thumbs up/down + comment (US-010, FR-12) |
| `api-reference.md` | Consolidated API contract for every endpoint (method/auth/request/response/validation/errors) |
| `testing-and-eval.md` | Unit/integration/E2E strategy + offline AI eval suite + acceptance-criteria matrix |
| `../../contractiq/.env.example` | Every environment variable, grouped by service |

## Recommended build order (maps to engineering-doc §10 phases)

1. **`supabase-schema.sql`** → run on the Supabase project. **`.env.example`** → copy to `.env.local`.
2. **`auth.md`** — Supabase clients, middleware, login/signup/logout.
3. **`pdf-upload-extraction.md`** — upload + text extraction (unblocks everything AI).
4. **`key-term-extraction.md`** — the core value: GPT-4o extraction.
5. **`results-and-viewer.md`** — display, viewer, inline edit.
6. **`contract-chat.md`** — grounded Q&A.
7. **`dashboard.md`** — history + delete.
8. **`feedback.md`** — feedback capture.
9. **`testing-and-eval.md`** — throughout, gated at each phase.

## Shared conventions (apply to every spec)

- **Stack:** Next.js 14 App Router + TypeScript; Supabase (Auth/Postgres/Storage/Realtime); OpenAI GPT-4o; `pdf-parse` (server) + PDF.js (client). Backend = Next.js Route Handlers under `app/api/*` (Node runtime, not Edge — `pdf-parse` needs Node).
- **Design system:** all UI uses `docs/design.md` tokens (Inter Display, brand Blue `#115ACB`, 4px grid, flat depth). Confidence colours: Green 500 (≥ 0.80), Yellow 500 (0.50–0.79), Red 500 (< 0.50).
- **Error envelope (all API routes):** `{ "error": { "code": string, "message": string, "retryable": boolean } }`. Never surface raw stack traces. HTTP status matches the error class.
- **Auth on every route:** resolve the Supabase session server-side; 401 if absent. Re-check row ownership before writes (defense-in-depth on top of RLS).
- **Validation:** Zod schemas in `lib/validation/schemas.ts`, shared between client pre-checks and server routes.
- **Extract-once invariant:** PDF text is extracted **once at upload** into `contracts.contract_text`. The process and chat routes read that column — they **never** re-download the PDF.
- **Non-blocking Storage:** a Storage failure leaves `file_path = null` and only hides the PDF viewer (text-viewer fallback still works). It never blocks extraction or chat.
- **"Not legal advice"** disclaimer is visible on every results page.

## Types

All domain types live in `contractiq/types/index.ts` (`Contract`, `KeyTerm`, `ChatMessage`,
`ChatSession`, `UserFeedback`, `ApiError`). Specs reference those names.
