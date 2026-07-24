# ContractIQ — Engineering Document (High-Level Design)

**Version:** 1.0
**Status:** Draft — awaiting approval (Stage 1)
**Source PRD:** `docs/ContractIQ_PRD.md` (v1.0, 2026-06-24)
**Author:** Engineering
**Last updated:** 2026-07-23

> This document is the authoritative architectural reference for ContractIQ. No implementation
> (Stage 3+) begins until it is approved. Granular, runnable specs — `docs/specs/*.md`,
> `supabase-schema.sql`, `.env.example` — are produced in Stage 2 (`/implementation-specs`) from this doc.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Scope](#2-product-scope)
3. [User Personas](#3-user-personas)
4. [User Flows](#4-user-flows)
5. [Frontend Architecture](#5-frontend-architecture)
6. [Backend Architecture](#6-backend-architecture)
7. [Database Design & Schema](#7-database-design--schema)
8. [AI Architecture](#8-ai-architecture)
9. [API Specification](#9-api-specification)
10. [Feature Breakdown](#10-feature-breakdown)
11. [Folder Structure](#11-folder-structure)
12. [Naming Conventions](#12-naming-conventions)
13. [Testing Strategy](#13-testing-strategy)
14. [Specs → Implementation Mapping](#14-specs--implementation-mapping)
15. [Appendix — Open Items & Doc Inconsistencies](#15-appendix--open-items--doc-inconsistencies)

---

## 1. Executive Summary

| Field | Detail |
|---|---|
| **Project** | ContractIQ |
| **Business goal** | Reduce NDA/MSA contract review from 90–120 minutes to ≤ 15 minutes for SMBs and freelancers who have no in-house legal team, while keeping every AI output traceable and correctable. |
| **Problem** | Business professionals sign NDAs and MSAs without understanding them. Manual review is slow (90–120 min), needs legal expertise, and costs $250–$500/hr. Generic AI (ChatGPT) gives unstructured summaries with no page attribution, no confidence score, and no contract-type schema. |
| **Solution** | Upload an NDA/MSA PDF → the system extracts the 20–30 terms that matter for that contract type, each with an extracted value, a 1-indexed page number, a self-reported confidence score, and the verbatim source sentence. Users can add custom terms, correct any value inline, and ask plain-English questions answered **strictly from the uploaded document text**. |
| **Target users** | Primary: time-pressed Founders / Ops / Procurement leads (5–250 employees, no legal counsel). Secondary: freelancers/consultants signing client MSAs. |

### Success Criteria (from PRD §3, §5, §10)

| Metric | Target | How measured |
|---|---|---|
| **North Star** — time from upload to completed review | ≤ 15 min (baseline 90 min) | Session logs (upload → review-complete / last-interaction) |
| Key-term extraction accuracy | ≥ 88% F1 (NDA), ≥ 85% F1 (MSA) | Offline eval vs. labelled test set (30 NDA + 20 MSA) |
| Confidence calibration | Predicted within ±10% of actual accuracy (error ≤ 0.10) | Monthly calibration curve |
| Time to first key-term display | ≤ 30 s P95 for ≤ 20-page contracts | Server-side timing logs |
| Chat response latency | ≤ 15 s P95 | Server-side timing logs |
| Page-attribution accuracy | ≥ 92% correct page | Eval vs. ground truth |
| Cost per analysis | ≤ $0.25 (extraction ≤ $0.20) per 20-page contract | OpenAI usage dashboard |
| Correction rate | ≤ 12% of terms manually corrected | `corrections_count / total_extracted_terms` |
| Chat hallucination rate | ≤ 5% responses | Monthly expert review of 50 Q&A pairs |

### Architecture at a Glance

- **Frontend:** Next.js 14 (App Router) + React + Tailwind CSS. Talks to Supabase directly for auth/data reads; calls internal API routes for all OpenAI-heavy work.
- **Backend:** Next.js **Route Handlers** (`app/api/*`) — a thin orchestration layer (PDF text extraction, OpenAI calls, structured-output parsing, DB writes). No business logic beyond orchestration. OpenAI key is server-side only.
- **AI:** OpenAI **GPT-4o** (JSON mode) for extraction, confidence scoring, and grounded chat. Claude documented as cost/outage fallback.
- **Data platform:** Supabase (Postgres + Auth + Storage + Realtime), single project, RLS on every table.
- **Core invariant:** PDF text is extracted **once at upload** into `contracts.contract_text` with `[PAGE N]` markers. Both the extraction pipeline and chat read from this stored text — the PDF file is **never re-downloaded** for AI work. Supabase Storage is used only for the inline PDF viewer and is **non-blocking**.

```
┌──────────────┐    HTTPS     ┌────────────────────────┐   HTTPS    ┌──────────────┐
│  Browser     │ ───────────▶ │  Next.js (Vercel)      │ ─────────▶ │  OpenAI API  │
│  React SPA   │ ◀─────────── │  ├─ App Router pages   │ ◀───────── │  (GPT-4o)    │
│  + PDF.js    │              │  └─ /api Route Handlers│            └──────────────┘
└──────┬───────┘              └──────────┬─────────────┘
       │  Supabase JS (auth, reads, Realtime)         │  service role
       │                                              │  (server-only)
       ▼                                              ▼
   ┌────────────────────────────── Supabase (single project) ──────────────────────────────┐
   │  Auth (email/password) │ Postgres (7 tables + RLS) │ Storage (contracts bucket) │ Realtime │
   └───────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Product Scope

### In Scope (MVP)

- Email/password authentication (Supabase Auth), private per-user data.
- Upload of **text-layer PDF** NDAs and MSAs — **≤ 10 MB, ≤ 20 pages, ≤ 15,000 tokens**.
- Server-side text extraction with `[PAGE N]` markers, stored in `contracts.contract_text`.
- GPT-4o key-term extraction: standard NDA/MSA term libraries + up to **5 custom terms**.
- Key terms panel: term name, extracted value, page number, confidence score (colour-coded).
- Low-confidence (< 50%) warning flag (never hides the term).
- Inline term editing (original AI value preserved for the feedback loop).
- Results page: interactive **PDF.js viewer** (primary) with a **paginated text-viewer fallback**; click-to-navigate from a term to its page.
- Expandable "Why?" source sentence per term.
- Contract chat (Q&A) grounded strictly in the document, with mandatory `[Page X]` citation and persistent history.
- Dashboard: contract history (totals, breakdown by type, sortable list).
- Thumbs up/down + comment feedback.
- Not-legal-advice disclaimer on every results page.

### Out of Scope (MVP)

- Scanned / image PDFs and OCR (fail gracefully: extracted text < 100 words → "Scanned PDFs are not supported yet").
- Non-English contracts; jurisdictions other than US/UK conventions.
- Contract types other than NDA and MSA.
- Batch upload, team/multi-user workspaces, contract comparison.
- CSV/PDF export (targeted P2 / v1.1).
- Chunked / vector RAG (full-context strategy at MVP).
- Fine-tuned models (v2).

### Future Enhancements (from PRD roadmap v1.1–v1.2)

| Release | Feature |
|---|---|
| v1.1 | Export key terms to CSV; export summary to PDF; batch upload (≤ 5); dashboard analytics charts |
| v1.2 | Scanned-PDF OCR (AWS Textract or equivalent); side-by-side contract comparison; email notification on completion; multi-user team workspace |

---

## 3. User Personas

| Persona | Role & context | Primary workflow | Permissions |
|---|---|---|---|
| **Time-Pressed Founder / Ops Lead** (primary) | Founder / COO / Procurement / Legal Ops at a 5–250-person company; no in-house counsel; signs 5–15 NDAs/MSAs per month | Upload contract → review extracted key terms → verify low-confidence terms → chat for specific clauses → keep a record on the dashboard | Full access to **own** contracts, terms, chats, feedback only (enforced by RLS `user_id = auth.uid()`). No access to other users' data. |
| **Freelancer / Consultant** (secondary) | Individual contributor signing client MSAs; 1–4/month; cannot afford legal review | Upload client MSA → check non-standard/risky clauses via confidence flags → chat ("Is there an auto-renewal clause?") | Same own-data-only permissions. |

**Responsibilities of the human-in-the-loop (both personas):** the user is always the decision-maker. The AI **suggests**; it never signs, sends, or takes irreversible action. Users verify low-confidence terms, correct extractions, and are shown a "not legal advice" disclaimer on every results page.

---

## 4. User Flows

Format: `User Action → Frontend Behavior → Backend Processing → Database Interaction → System Response`.

### Flow 1 — New Visitor → Sign Up → Dashboard (US-001)

```
Land on marketing page
  → Frontend: render value prop + demo GIF + "Sign In" / "Get Started Free" CTAs
Click "Get Started Free" + enter email/password
  → Frontend: Supabase Auth signUp() from client
  → Backend: (Supabase Auth service) creates auth user, sends verification
  → DB: row created in auth.users; app-level profile row ensured on first authed request
Verify email → sign in
  → System: redirect to /dashboard; empty state "No contracts reviewed yet — upload your first contract to begin"
```

### Flow 2 — Returning User → Dashboard (US-008)

```
Sign In (email/password)
  → Frontend: Supabase Auth signInWithPassword(); session token stored in browser
  → DB: RLS-scoped SELECT on contracts WHERE user_id = auth.uid()
  → System: /dashboard shows summary card (total contracts, NDA/MSA breakdown, last 5 reviewed
             with status + date) + prominent "Review a Contract" CTA
```

### Flow 3 — Core Flow: Contract Review (US-002..005, 011-partial)

```
Click "Review Contract"
  → Frontend: /review — select contract type (NDA | MSA) from dropdown, drag-drop / pick PDF
Select PDF (≤ 10 MB / ≤ 20 pages)
  → Frontend: client-side size/type pre-check; POST multipart to /api/contracts/upload
  → Backend (upload route):
       1. validate size/pages/type
       2. pdf-parse → text with [PAGE N] markers
       3. guard: text < 100 words → reject "Scanned PDFs are not supported yet"
       4. guard: > 15,000 tokens → reject "Contract too long for MVP"
       5. (non-blocking) upload PDF to Storage contracts/{user_id}/{contract_id}/{file}.pdf
  → DB: INSERT contracts { user_id, name, type, contract_text, page_count, file_path?, status='uploaded' }
  → System: show pre-processing preview — standard terms for the selected type
Preview standard terms + (optional) "+ Add Key Term" up to 5
  → Frontend: custom terms shown with "Custom" badge
  → DB: custom terms staged (persisted with is_manual=true on process)
Click "Process Contract"
  → Frontend: progress stepper (1 extracting text · 2 analysing with AI · 3 compiling results)
  → Backend (process route): build few-shot prompt (standard + custom terms) → GPT-4o JSON mode
       → parse JSON array; single JSON-repair retry on parse failure; validate schema & confidence
  → DB: INSERT key_terms[] + custom_key_terms[]; UPDATE contracts.status='complete'
  → System: redirect to /contracts/[id] results page (two-panel layout)
Results page
  → Left: PDF.js viewer (scroll/zoom, highlighted spans) OR text-viewer fallback if Storage unavailable
  → Right: key terms list — Name | Value | Page | Confidence (green ≥80 / amber 50–79 / red <50)
           · <50% shows ⚠️ + non-dismissible tooltip; PDF auto-highlights nearest page span
           · each term has expandable "Why?" (verbatim source_sentence)
           · click page number → viewer scrolls to page
Edit a term inline (US-009)
  → Frontend: inline editor; PATCH /api/key-terms/[id]
  → DB: UPDATE key_terms SET value, is_edited=true (ai_original_value preserved)
  → System: "Edited" badge appears (save ≤ 2 s)
```

**Core pipeline sequence (extract-once invariant):**

```
Upload ──▶ pdf-parse ──▶ contracts.contract_text ([PAGE N])
                                │
                 ┌──────────────┴───────────────┐
                 ▼                              ▼
         Process (GPT-4o extract)        Chat (GPT-4o Q&A)
         reads contract_text             reads contract_text
                 │                              │
                 ▼                              ▼
          key_terms rows                 chat_messages rows
   (PDF file is NEVER re-downloaded for AI work — Storage only feeds the viewer)
```

### Flow 4 — Chat with Contract (US-007, US-012)

```
Results page → click "Chat" tab → type question
  → Frontend: POST /api/contracts/[id]/chat { message }
  → Backend (chat route):
       1. load contracts.contract_text + full session history (≤ 200 msgs, ascending)
       2. classify query (contract | history | both) — adjusts system prompt, no extra API call
       3. GPT-4o (temp 0.4): system prompt = "Answer only from the document text provided.
          If the answer is not in the document, say so." Prefix "Based on the document…"; require [Page X]
  → DB: INSERT chat_messages (role='user'), then (role='assistant') linked to chat_sessions → contracts
  → System: response left-aligned with [Page X] citation → click scrolls PDF viewer to page (≤ 15 s)
Reopen contract later
  → DB: SELECT chat_messages by session → previous conversation restored
```

---

## 5. Frontend Architecture

### Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript, React Server + Client Components |
| Styling | Tailwind CSS, tokens bound to `docs/design.md` (allNeurons design system) |
| Data / auth client | `@supabase/supabase-js` + `@supabase/ssr` (browser + server clients) |
| PDF rendering | PDF.js (`pdfjs-dist`) — client-only, lazy-loaded per page |
| Realtime | Supabase Realtime subscription for chat message streaming |
| State management | React local state + hooks; server state via Supabase queries. No global store needed at MVP (contained per route). `useContractSession` hook coordinates terms + viewer + chat on the results page. |
| Icons | Lucide React |
| Validation (shared) | Zod schemas shared between client pre-checks and server route handlers |

### Route Map (App Router)

| Route | Type | Auth | Purpose |
|---|---|---|---|
| `/` | Public | — | Marketing/landing (value prop, demo GIF, CTAs) |
| `/login`, `/signup` | Public | — | Supabase Auth email/password |
| `/dashboard` | Protected | ✅ | Summary card + sortable contract history + "Review a Contract" CTA |
| `/review` | Protected | ✅ | Contract-type selector, upload, pre-processing preview, custom terms, process trigger |
| `/contracts/[id]` | Protected | ✅ | Two-panel results: PDF/text viewer + key terms panel + chat tab |
| `/settings` / `/profile` | Protected | ✅ | Account, data deletion (GDPR) |

### Component Hierarchy

```
app/
  (marketing)/page.tsx ............ Landing
  (auth)/login, signup ............ AuthForm
  dashboard/page.tsx
    └─ SummaryCard, ContractTable (sortable), EmptyState
  review/page.tsx
    └─ ContractTypeSelect
       UploadZone (drag-drop, client size/type guard)
       TermPreviewList
         └─ StandardTermChip[], CustomTermInput (+ Add Key Term, max 5), CustomTermChip[]
       ProcessButton → ProgressStepper
  contracts/[id]/page.tsx  (ResultsLayout — two panel)
    ├─ Left:  DocumentViewer
    │           ├─ PdfViewer (PDF.js, targetPage prop)   ← primary
    │           └─ TextViewer ([PAGE N] fallback, targetPage prop)  ← Storage-down fallback
    ├─ Right: KeyTermsPanel
    │           └─ TermRow (value, page link, ConfidenceBadge, LowConfidenceWarning, WhyDisclosure, InlineEditor)
    ├─ ChatPanel (message list, Citation[Page X], composer)
    ├─ FeedbackWidget (thumbs + comment)
    └─ NotLegalAdviceDisclaimer  (always visible)
```

Both viewers accept the same `targetPage` prop and respond to key-term click events, so click-to-navigate behaves identically whether Storage is available or not (PRD FR-06/FR-07).

### UX States (WCAG 2.1 AA)

| State | Handling |
|---|---|
| **Loading** | Skeletons for dashboard/terms; ProgressStepper (3 steps) during processing; typing indicator in chat |
| **Empty** | Dashboard: "No contracts reviewed yet…"; chat: prompt suggestions |
| **Error** | Human-readable messages with retry CTA — upload rejection (size/pages/scanned/too-long), OpenAI timeout ("Try again in a few minutes"), Storage failure (viewer hidden, banner: "Preview unavailable — analysis unaffected"), contract `status='error'` re-processable without re-upload |
| **Low confidence** | ⚠️ + non-dismissible tooltip; auto-highlight nearest page span |
| **Responsive** | Two-panel collapses to stacked tabs on mobile; recommend desktop Chrome/Firefox; warn mobile users on large PDFs |
| **Accessibility** | Keyboard-navigable, visible focus ring (Blue 500, 2px), ARIA labels, colour + icon (not colour alone) for confidence, all legal jargon tooltipped in plain English |

### Design System Binding

All colours, type, spacing, radius come from `docs/design.md`. Notable mappings:

- **Confidence colour code** → Green 500 `#13A10E` (≥ 80), Yellow 500 `#FFAA33` (50–79), Red 500 `#D13438` (< 50) — using semantic status-badge pattern (bg 50 / border 200 / text 700).
- **Brand/interactive** → Blue 500 `#115ACB` (CTAs, links, focus, page-link).
- **Type** → Inter Display; section headers H5 (24/500), body 16/500, metadata 12/400.
- **Spacing** → 4px grid; page padding 96/112; section gap 40.

---

## 6. Backend Architecture

### Stack & Runtime

- **Next.js Route Handlers** under `app/api/*` (Node.js runtime for `pdf-parse` and OpenAI SDK — not Edge, because `pdf-parse` needs Node APIs).
- **Supabase service-role client** used server-side only for privileged writes; anon client + RLS for user-scoped reads.
- **OpenAI Node SDK** — key read from `OPENAI_API_KEY` server env, never shipped to the client.

### Core Systems

| System | Design |
|---|---|
| **Auth** | Supabase Auth (email/password). Session in cookies via `@supabase/ssr`. |
| **Route protection** | `middleware.ts` guards `/dashboard`, `/review`, `/contracts/*`, `/settings`, `/profile` — unauthenticated → `/login`. |
| **Authorization** | Every table row carries `user_id`; **RLS** enforces `user_id = auth.uid()` for SELECT/INSERT/UPDATE/DELETE. Server routes additionally re-check ownership before writes. |
| **Validation** | Zod schemas per route (file size/pages/type, ≤ 5 custom terms, message length). Reject with structured 4xx + message. |
| **Error handling** | Standard envelope `{ error: { code, message, retryable } }`. OpenAI: **3× retry with exponential backoff**; on final failure set `contracts.status='error'` and return a retry CTA. JSON-parse failure → one JSON-repair retry prompt before erroring. No silent failures. |
| **Rate limiting** | Per-user limiter on OpenAI-calling routes (`/process`, `/chat`) to protect cost/latency budgets (e.g. token-bucket keyed by `user_id`; plan-tier aware later). |
| **Storage (non-blocking)** | PDF upload to `contracts/{user_id}/{contract_id}/{filename}.pdf`. Failure only leaves `file_path = null` and hides the viewer; the AI pipeline continues on stored text. Viewer served via **1-hour signed URL**. |
| **Extract-once invariant** | Text extracted at upload → `contracts.contract_text`. `/process` and `/chat` read the DB; neither re-downloads the PDF. |
| **Data retention** | PDFs auto-deleted 90 days post last-access (scheduled job); user-initiated delete removes contract + all children + Storage object. |

### Service Interaction Diagram

```
Client ──(1) POST /api/contracts/upload (multipart)
   │
   ▼
[upload route] ─ validate ─ pdf-parse ─▶ contracts.contract_text  (DB)
   │                         └─(async, non-blocking)─▶ Storage bucket
   ▼
Client ──(2) POST /api/contracts/[id]/process
   │
   ▼
[process route] ─ read contract_text (DB) ─ build few-shot prompt ─▶ OpenAI GPT-4o (JSON mode)
   │                                             │ (3× retry, JSON-repair retry)
   │◀────────────────────── parsed + validated ──┘
   ▼
key_terms[] + custom_key_terms[] (DB) ─ status='complete'
   │
   ▼
Client ──(3) POST /api/contracts/[id]/chat
   │
   ▼
[chat route] ─ read contract_text + history (DB) ─ classify query ─▶ OpenAI GPT-4o (temp 0.4)
   │◀──────── grounded answer + [Page X] ─────────┘
   ▼
chat_messages (user + assistant) (DB) ── Realtime push ──▶ Client
```

---

## 7. Database Design & Schema

Single Supabase Postgres project. Every table has a `user_id` FK and **RLS** so users see only their own rows (FR-13). All timestamps `timestamptz default now()`. Complete DDL, RLS policies, indexes, triggers, Storage bucket and Storage policies are produced as a single paste-and-run SQL file in **Stage 2** (FR-14).

### ER Diagram

```
auth.users (Supabase)
     │ 1
     │
     ├───────────────┐───────────────┐───────────────┐
     ▼ N             ▼ N             ▼ N             ▼ N
 contracts       (dashboard reads)  user_feedback   chat_sessions
     │ 1                                                 │ 1
     ├──────────────┬──────────────┐                     ▼ N
     ▼ N            ▼ N             ▼ N              chat_messages
 key_terms   custom_key_terms   user_feedback
```

### Tables

**`contracts`** — one uploaded contract.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK (default gen_random_uuid()) | |
| `user_id` | uuid FK → auth.users | **indexed**; RLS key |
| `name` | text | original filename / display name |
| `contract_type` | text CHECK in ('NDA','MSA') | selected by user |
| `contract_text` | text | full extracted text with `[PAGE N]` markers (single source of truth) |
| `page_count` | int | ≤ 20 |
| `token_count` | int | ≤ 15,000 (guard) |
| `file_path` | text NULL | Storage path; null if Storage upload failed |
| `status` | text CHECK in ('uploaded','processing','complete','error') | drives UI + retry |
| `created_at` / `last_accessed_at` | timestamptz | retention (90-day auto-delete) |

Indexes: `(user_id)`, `(user_id, created_at desc)` for dashboard sort.

**`key_terms`** — standard extracted terms.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `contract_id` | uuid FK → contracts (ON DELETE CASCADE) | **indexed** |
| `user_id` | uuid FK | RLS key (denormalised) |
| `term_name` | text | |
| `value` | text | current (possibly edited) value |
| `ai_original_value` | text | preserved AI value for feedback loop |
| `page_number` | int | 1-indexed |
| `confidence_score` | numeric(4,3) | 0.000–1.000 |
| `source_sentence` | text | verbatim; term with none is treated unreliable |
| `is_edited` | boolean default false | drives "Edited" badge |
| `created_at` | timestamptz | |

**`custom_key_terms`** — user-added terms (≤ 5/contract, FR-05). Same shape as `key_terms` plus `is_manual boolean default true`. (May be modelled as a flag column on `key_terms` in Stage 2; kept conceptually separate here per PRD.)

**`chat_sessions`** — one per contract's conversation.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `contract_id` | uuid FK → contracts (CASCADE) | **indexed**, unique per contract |
| `user_id` | uuid FK | RLS key |
| `created_at` | timestamptz | |

**`chat_messages`** — full conversation (≤ 200 passed to model, ascending).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `session_id` | uuid FK → chat_sessions (CASCADE) | **indexed** |
| `user_id` | uuid FK | RLS key |
| `role` | text CHECK in ('user','assistant') | |
| `content` | text | assistant content includes `[Page X]` |
| `created_at` | timestamptz | ordering key (ascending) |

**`user_feedback`** — thumbs + comment (FR-12).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `contract_id` | uuid FK → contracts (CASCADE) | |
| `user_id` | uuid FK | RLS key |
| `rating` | text CHECK in ('up','down') | |
| `comment` | text NULL | optional |
| `created_at` | timestamptz | |

**Storage** — bucket `contracts`; object path `contracts/{user_id}/{contract_id}/{filename}.pdf`. Three `storage.objects` policies (INSERT/SELECT/DELETE) restrict to `auth.uid()::text = (storage.foldername(name))[1]`. Bucket + policies created via SQL (`INSERT INTO storage.buckets`, `CREATE POLICY ON storage.objects`) — **not** the dashboard (FR-14, PRD assumption 13).

**Derived view (feedback loop):** `term_corrections` view over `key_terms WHERE is_edited = true` exposing `(term_name, ai_original_value, value)` to compute the 7-day correction rate (Prompt Strategy §8).

---

## 8. AI Architecture

### Provider & Model

| Item | Value | Rationale |
|---|---|---|
| Primary model | **OpenAI GPT-4o** | Best-in-class legal-text reasoning; JSON mode; ≥ 128k context |
| Fallback | **Anthropic Claude** (tool-use for structured output) | PRD-named contingency if OpenAI cost doubles or during outages; documented, not wired at MVP |
| Context window | ≥ 128k | 20-page contract ≈ 10–15k tokens + prompt + history headroom |
| Response format | JSON mode (`response_format: { type: "json_object" }`) for extraction | Eliminates unparseable output |
| Max output tokens | 2,000 (extraction) / 1,000 (chat) | Bounded output |
| Temperature | 0.1 (extraction) / 0.4 (chat) | Deterministic extraction; slight warmth for chat |
| Latency budget | ≤ 20 s per call P95 | Combined UX target ≤ 30 s end-to-end |
| Cost | ≤ $0.20 extraction / ≤ $0.25 total per 20-page analysis | ~15k input + 1.5k output ≈ $0.097 at GPT-4o pricing |

### Grounding Strategy (trust guarantee)

- **Single source of truth:** the model only ever sees `contracts.contract_text` (the user's own document) — extracted once at upload.
- **Extraction grounding:** every term carries `source_sentence` (verbatim) + 1-indexed `page_number`, surfaced in the "Why?" disclosure.
- **Chat grounding (RAG-style, full-context):** the **entire** contract text (≤ 15k tokens) is passed on every turn — no chunking/vector retrieval at MVP, guaranteeing no clause is missed by retrieval error. System prompt: *"Answer only from the document text provided. If the answer is not in the document, say so."* Every response requires a `[Page X]` citation.
- **Conversation memory:** full history (≤ 200 messages, ascending) passed each turn → memory-style questions work. A **query-classification** step labels each question `contract | history | both` and adjusts the system prompt / context inclusion **without an extra API call**.
- **"Not found" is a valid answer:** "I cannot find this in the document" is the correct response when info is absent — not a failure.

### Prompt Strategy

| Task | Technique | Output |
|---|---|---|
| Key-term extraction | Few-shot (3 NDA + 3 MSA labelled examples in system prompt) | JSON array `[{ term_name, value, page_number, confidence_score, source_sentence }]` |
| Confidence scoring | Embedded in extraction prompt (model self-reports 0.0–1.0 per term) | float field in each term object (no 2nd call) |
| Custom-term extraction | Zero-shot; custom term names appended to the standard target list | same JSON schema |
| Contract chat | Full contract text + history + document-only system prompt | free text with mandatory `[Page X]` |
| Error recovery | On JSON parse failure, one retry: "Your previous response was not valid JSON. Return only the JSON array, no explanation." | JSON array |

**Standard term libraries** — NDA: Parties, Effective Date, Confidentiality Obligations, Permitted Disclosures, Term & Duration, Governing Law, Jurisdiction, IP Ownership, Non-Solicitation, Breach & Remedy. MSA: Parties, Service Scope, Payment Terms, Invoice Schedule, Late Payment Penalty, Liability Cap, Indemnification, IP Ownership, Termination Clause, Governing Law, Dispute Resolution, Notice Period.

### Hallucination Guardrails (top trust risk)

| Layer | Control |
|---|---|
| Extraction | Confidence per term (colour-coded); < 50% → ⚠️ + non-dismissible tooltip (never hidden); mandatory `source_sentence`; temp 0.1 + JSON mode; monthly calibration check (UI warning if ≥ 15% miscalibration) |
| Chat | Document-only system prompt; "I cannot find this in the document" fallback; mandatory `[Page X]`; "Based on the document…" prefix; automated regression test (ask about absent topic → expect "I cannot find this") |
| UI / human-in-loop | Inline correction (AI original preserved); PDF auto-highlight of nearest span for low-confidence terms; **"Not legal advice" disclaimer on every results page** |

### Cost & Reliability Controls

- Prioritise 10–12 most material terms by default (avoid overwhelming the user).
- Per-user rate limiting on OpenAI routes; monthly usage monitoring with alert at 80% of budget.
- 3× retry with exponential backoff; on failure `status='error'` + retry CTA (no re-upload needed).
- `user` parameter set on OpenAI calls; no training opt-in (GDPR).

---

## 9. API Specification

All routes are Next.js Route Handlers under `app/api/`. All require an authenticated Supabase session unless noted; all enforce row ownership (RLS + explicit check). Standard error envelope: `{ error: { code, message, retryable } }`.

### `POST /api/contracts/upload`

- **Purpose:** accept a PDF, extract text, create the contract row, (non-blocking) store the PDF.
- **Auth:** required.
- **Request:** `multipart/form-data` — `file` (PDF), `contract_type` (`NDA` | `MSA`).
- **Validation:** ≤ 10 MB; ≤ 20 pages; `application/pdf`; extracted text ≥ 100 words (else scanned-PDF error); ≤ 15,000 tokens.
- **Response 201:** `{ contract_id, name, contract_type, page_count, status: 'uploaded', standard_terms: string[], file_available: boolean }`.
- **Errors:** `413 FILE_TOO_LARGE`, `422 TOO_MANY_PAGES`, `422 SCANNED_PDF_UNSUPPORTED`, `422 CONTRACT_TOO_LONG`, `415 UNSUPPORTED_TYPE`.

### `POST /api/contracts/[id]/process`

- **Purpose:** run GPT-4o extraction over stored text (standard + custom terms).
- **Request:** `{ custom_terms?: string[] (≤ 5) }`.
- **Validation:** contract owned by user; `status != 'processing'`; ≤ 5 custom terms.
- **Response 200:** `{ contract_id, status: 'complete', key_terms: [{ id, term_name, value, page_number, confidence_score, source_sentence, is_manual }] }`.
- **Errors:** `429 RATE_LIMITED`, `502 OPENAI_UNAVAILABLE` (retryable, after 3 retries; sets `status='error'`), `422 EXTRACTION_PARSE_FAILED` (after JSON-repair retry).

### `GET /api/contracts`

- **Purpose:** dashboard list. **Response 200:** `{ total, by_type: { NDA, MSA }, contracts: [{ id, name, contract_type, status, created_at }] }` (sortable client-side by date/name/type).

### `GET /api/contracts/[id]`

- **Purpose:** results-page load. **Response 200:** `{ contract, key_terms[], signed_url?: string (1h, null if file unavailable), page_count }`.

### `PATCH /api/key-terms/[id]`

- **Purpose:** inline edit (US-009). **Request:** `{ value }`. **Behaviour:** `ai_original_value` preserved, `is_edited=true`. **Response 200 (≤ 2 s):** updated term. **Error:** `403 NOT_OWNER`.

### `POST /api/contracts/[id]/chat`

- **Purpose:** grounded Q&A. **Request:** `{ message }`. **Validation:** message length bound; contract owned. **Behaviour:** load `contract_text` + history (≤ 200 asc), classify query, GPT-4o (temp 0.4), enforce `[Page X]`, persist user+assistant messages. **Response 200 (≤ 15 s):** `{ message: { role:'assistant', content, page_citation } }`. **Errors:** `429 RATE_LIMITED`, `502 OPENAI_UNAVAILABLE`.

### `GET /api/contracts/[id]/messages`

- **Purpose:** load persisted chat history (US-012). **Response 200:** `{ session_id, messages: [{ role, content, created_at }] }` ascending.

### `POST /api/feedback`

- **Purpose:** thumbs + comment (US-010, FR-12). **Request:** `{ contract_id, rating: 'up'|'down', comment? }`. **Response 201:** `{ id }`.

### `DELETE /api/contracts/[id]`

- **Purpose:** user-initiated delete of a contract + all children + Storage object (GDPR). **Response 204.** **Error:** `403 NOT_OWNER`.

---

## 10. Feature Breakdown

### Phase 1 — MVP Core (PRD roadmap v0.1–v0.3; US-001..005, 011-partial; FR-01..05, 11, 13, 14)

| Feature | Acceptance criteria (from PRD) | Dependencies |
|---|---|---|
| **Auth (US-001, FR-01)** | Sign up/in/out via Supabase Auth; flow ≤ 10 s; redirect to Dashboard on success; clear error on invalid creds; session persists | Supabase project + Auth |
| **Upload + text extraction (US-002, FR-02/03)** | ≤ 10 MB / ≤ 20 pages accepted; text extracted with `[PAGE N]` at upload → `contracts.contract_text`; scanned/too-long rejected clearly | `contracts` table, pdf-parse, upload route |
| **Key-term extraction + panel (US-011-partial, FR-04)** | Panel shows Name/Value/Page/Confidence; ≥ 80% of standard terms populated; extraction ≤ 30 s P95 | process route, GPT-4o, `key_terms` |
| **Confidence display + low-confidence warning (US-004, FR-11)** | 0–100% shown; < 50% shows ⚠️ + tooltip; term never hidden | key-term extraction |
| **Page attribution (US-003)** | Each term shows page; click scrolls viewer to page | key_terms, viewer |
| **Custom terms (US-005, FR-05)** | ≥ 5 custom terms added pre-processing; results include them with same structure; `is_manual=true` | process route |
| **Single-file DB setup (FR-13/14)** | All tables + RLS + indexes + triggers + Storage bucket + Storage policies as one runnable SQL file | Stage 2 output |

### Phase 2 — Enriched Experience & Chat (roadmap v0.3–v0.4; US-006..009, 012; FR-06..10)

| Feature | Acceptance criteria | Dependencies |
|---|---|---|
| **PDF viewer + text fallback (US-006, FR-06/07)** | Renders all pages, scroll/zoom, clickable highlights; text-viewer fallback when Storage unavailable; both respond to `targetPage` | Storage signed URL, PDF.js |
| **Contract chat (US-007, FR-08/09)** | ≤ 15 s response, grounded in document, `[Page X]` citation; messages saved with role+timestamp | chat route, `chat_sessions/messages` |
| **Persistent chat history (US-012)** | Reopening a contract loads prior session | messages route |
| **Dashboard history (US-008, FR-10)** | Totals + NDA/MSA breakdown + sortable list; row click opens results | contracts list route |
| **Inline term editing (US-009)** | Save ≤ 2 s; "Edited" badge; AI original stored separately | PATCH key-terms route |
| **Pre-processing preview + "Why?" disclosure** | Standard terms previewed before processing; verbatim source sentence per term | upload response, key_terms |

### Phase 3 — Launch Hardening & Post-Launch (roadmap v1.0–v1.2; US-010, 011; P2 + future)

| Feature | Acceptance criteria | Dependencies |
|---|---|---|
| **Feedback (US-010, FR-12)** | Thumbs up/down + optional comment saved to `user_feedback` | feedback route |
| **Export CSV/PDF (US-011)** | Formatted file generated ≤ 5 s, downloads in browser | key_terms |
| **Security audit / rate limiting / WCAG review / onboarding** | RLS verified (cross-user access blocked), signed-URL expiry, OpenAI rate limiting, WCAG 2.1 AA, first-run tooltips | Stage 7 `/security-foundation` |
| **Future (v1.1–v1.2)** | Batch upload (≤ 5); analytics charts; OCR; comparison view; email notifications; team workspaces | out of MVP scope |

---

## 11. Folder Structure

```
contractiq/
├── app/
│   ├── (marketing)/
│   │   └── page.tsx ................... Landing page
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── dashboard/page.tsx ............. Contract history + summary
│   ├── review/page.tsx ............... Upload + preview + custom terms + process
│   ├── contracts/[id]/page.tsx ....... Results (viewer + terms + chat)
│   ├── settings/page.tsx
│   ├── api/
│   │   ├── contracts/
│   │   │   ├── upload/route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts .......... GET (results), DELETE
│   │   │       ├── process/route.ts
│   │   │       ├── chat/route.ts
│   │   │       └── messages/route.ts
│   │   ├── key-terms/[id]/route.ts ... PATCH inline edit
│   │   └── feedback/route.ts
│   ├── layout.tsx
│   └── globals.css ................... Tailwind + design-system tokens
├── components/
│   ├── ui/ ........................... Buttons, badges, tooltips (design-system primitives)
│   ├── upload/ ....................... UploadZone, ContractTypeSelect, TermPreviewList
│   ├── results/ ...................... KeyTermsPanel, TermRow, ConfidenceBadge, WhyDisclosure, InlineEditor
│   ├── viewer/ ....................... DocumentViewer, PdfViewer, TextViewer
│   ├── chat/ ......................... ChatPanel, MessageList, Composer, Citation
│   └── dashboard/ .................... SummaryCard, ContractTable, EmptyState
├── lib/
│   ├── supabase/ ..................... browser.ts, server.ts, service.ts (clients)
│   ├── openai/ ....................... client.ts, extract.service.ts, chat.service.ts
│   ├── pdf/ .......................... extract.ts (pdf-parse + [PAGE N] markers), tokens.ts
│   ├── prompts/ ...................... extraction.prompt.ts, chat.prompt.ts, term-libraries.ts
│   ├── validation/ ................... schemas.ts (Zod)
│   └── utils/ ........................ confidence.ts (colour mapping), errors.ts
├── hooks/ ............................ useContractSession, useChat, useKeyTerms
├── types/ ........................... contract.ts, key-term.ts, chat.ts, api.ts
├── middleware.ts .................... route protection
├── supabase/
│   └── schema.sql ................... (Stage 2) tables + RLS + Storage
├── docs/ ............................ engineering/, specs/, design.md, security/
├── .env.example ..................... (Stage 2)
└── package.json
```

> `.claude/launch.json` already targets a `contractiq/` directory on port 4173 — scaffolding in Stage 3 should create the project at that path.

---

## 12. Naming Conventions

| Kind | Convention | Example |
|---|---|---|
| Folders | kebab-case | `key-terms/`, `contracts/[id]/` |
| React components | PascalCase file + export | `KeyTermsPanel.tsx` → `KeyTermsPanel` |
| Hooks | `useX` camelCase | `useContractSession.ts` |
| Services / libs | `*.service.ts` / domain name | `extract.service.ts`, `confidence.ts` |
| Route handlers | `route.ts` in route folder | `app/api/contracts/upload/route.ts` |
| API paths | kebab, resource-oriented | `/api/contracts/[id]/chat` |
| DB tables | snake_case, plural | `key_terms`, `chat_messages` |
| DB columns | snake_case | `confidence_score`, `ai_original_value` |
| Types / interfaces | PascalCase | `KeyTerm`, `ContractStatus` |
| Env vars | SCREAMING_SNAKE; public prefixed | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` |
| Zod schemas | `xSchema` | `uploadSchema`, `chatMessageSchema` |
| Config files | lowercase dotted | `tailwind.config.ts`, `next.config.mjs` |

**Environment variables (grouped):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL` (default `gpt-4o`). (Full set enumerated in Stage 2 `.env.example`.)

---

## 13. Testing Strategy

| Layer | Scope | Framework | Coverage target |
|---|---|---|---|
| **Unit** | Extraction JSON parsing + JSON-repair retry; confidence → colour mapping; token counting / page-marker parsing; Zod validators; error envelope | Vitest (or Jest) | ≥ 80% of `lib/` |
| **Integration** | Route handlers with a test Supabase instance; **RLS cross-user isolation** (User A cannot read User B's contracts/terms/chats — PRD "Low/Critical" risk); Storage-down path leaves `file_path=null` and viewer hidden; OpenAI mocked (success, timeout→retry, JSON-repair) | Vitest + Supabase test project | All API routes; RLS asserted per table |
| **E2E** | Auth (sign up → dashboard); core review (upload → extract → results); page-link navigation; inline edit + badge; **chat groundedness** incl. the "I cannot find this" regression (question about absent topic) | Playwright | Critical paths (Flows 1–4) |

### AI Evaluation Suite (offline, from PRD §10 — every release / monthly)

| Eval | Method | Target |
|---|---|---|
| Extraction accuracy | P/R/F1 vs. labelled set (30 NDA + 20 MSA) | ≥ 88% F1 NDA / ≥ 85% MSA |
| Page accuracy | % terms with correct `page_number` | ≥ 92% |
| Custom-term accuracy | F1 on 10 custom terms × 15 contracts | ≥ 80% |
| Confidence calibration | predicted vs. actual, 10% buckets | error ≤ 0.10 |
| Chat groundedness | 50 Q&A pairs expert-scored | ≤ 5% hallucinated |
| End-to-end latency | P95 upload→results | ≤ 30 s |

CI: regression suite on every deploy; alert if 7-day correction rate > 12%.

---

## 14. Specs → Implementation Mapping

Each MVP feature maps to concrete files and a spec→code flow. Stage 2 expands each into a granular spec file.

| Feature (US / FR) | Implementation files | Flow |
|---|---|---|
| **Auth** (US-001, FR-01) | `app/(auth)/login`, `signup`, `lib/supabase/{browser,server}.ts`, `middleware.ts` | Form → Supabase Auth → session cookie → middleware guards protected routes → `/dashboard` |
| **Upload + extraction** (US-002, FR-02/03) | `app/review/page.tsx`, `components/upload/*`, `app/api/contracts/upload/route.ts`, `lib/pdf/extract.ts`, `lib/pdf/tokens.ts`, `contracts` table | UploadZone → POST multipart → validate → pdf-parse `[PAGE N]` → INSERT `contract_text` → preview |
| **Key-term extraction + panel** (US-011p, FR-04) | `app/api/contracts/[id]/process/route.ts`, `lib/openai/extract.service.ts`, `lib/prompts/*`, `components/results/KeyTermsPanel.tsx`, `key_terms` | Read `contract_text` → few-shot GPT-4o JSON → validate → INSERT `key_terms` → render panel |
| **Confidence + warning** (US-004, FR-11) | `components/results/ConfidenceBadge.tsx`, `LowConfidenceWarning.tsx`, `lib/utils/confidence.ts` | `confidence_score` → colour map → < 50% ⚠️ + tooltip + auto-highlight |
| **Page attribution** (US-003) | `TermRow.tsx`, `components/viewer/*` (`targetPage`) | Click page number → set `targetPage` → viewer scrolls |
| **Custom terms** (US-005, FR-05) | `components/upload/CustomTermInput.tsx`, process route, `custom_key_terms` | Add ≤ 5 → append to prompt → results include with `is_manual=true` |
| **Viewer + fallback** (US-006, FR-06/07) | `DocumentViewer.tsx`, `PdfViewer.tsx`, `TextViewer.tsx`, `GET /api/contracts/[id]` (signed URL) | Storage signed URL → PdfViewer; null → TextViewer parses `[PAGE N]` |
| **Chat** (US-007/012, FR-08/09) | `app/api/contracts/[id]/chat/route.ts`, `messages/route.ts`, `lib/openai/chat.service.ts`, `components/chat/*`, `chat_sessions/messages` | Load text+history → classify → GPT-4o → `[Page X]` → persist → Realtime render |
| **Dashboard** (US-008, FR-10) | `app/dashboard/page.tsx`, `components/dashboard/*`, `GET /api/contracts` | RLS-scoped query → summary + sortable table → row → results |
| **Inline edit** (US-009) | `components/results/InlineEditor.tsx`, `PATCH /api/key-terms/[id]` | Edit → PATCH → preserve `ai_original_value`, `is_edited=true` → badge |
| **Feedback** (US-010, FR-12) | `components/results/FeedbackWidget.tsx`, `POST /api/feedback`, `user_feedback` | Thumbs + comment → INSERT |
| **DB setup** (FR-13/14) | `supabase/schema.sql` (Stage 2) | One runnable SQL: tables + RLS + indexes + triggers + Storage bucket + policies |

---

## 15. Appendix — Open Items & Doc Inconsistencies

Non-blocking items to resolve before Stage 2 (`/implementation-specs`):

1. **Design-system source of truth:** `README.md` describes fonts as "Inter + JetBrains Mono" and brand `#112E81`, but `docs/design.md` (the actual token file) uses **Inter Display** only and brand Blue **`#115ACB`**. This doc follows `docs/design.md`. Confirm before UI work.
2. **Security stage numbering:** `CLAUDE.md` places `/security-foundation` at **Stage 7**; `README.md` implies Stage 3. This doc follows CLAUDE.md (Stage 7).
3. **Implementation-specs input path:** the `implementation-specs` SKILL frontmatter references `docs/engineering-plan.md`, but every other doc uses `docs/engineering/engineering-doc.md` (this file). Stage 2 should read **this file**.
4. **Custom terms modelling:** PRD names a separate `custom_key_terms` table (FR-05) while also describing an `is_manual` flag. Stage 2 to decide: separate table vs. `is_manual` column on `key_terms`. This doc keeps them conceptually separate.
5. **Backend runtime decision (resolved):** Next.js Route Handlers chosen over Supabase Edge Functions (PRD left it open) for single-deploy simplicity and Node runtime required by `pdf-parse`. Documented here; revisit only if edge latency becomes a constraint.
6. **LLM provider (resolved):** GPT-4o primary per PRD; Claude documented as fallback. If org direction mandates Claude as primary, swap extraction to tool-use structured output and re-baseline the eval/cost numbers.

---

*End of Engineering Document v1.0 — awaiting Stage 1 approval.*
