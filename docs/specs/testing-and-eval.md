# Spec — Testing & AI Evaluation

**Implements:** engineering-doc §13 · PRD §10 · Internal Risks
**Frameworks:** Vitest (unit/integration) · Playwright (E2E) · a lightweight offline eval script for AI metrics.

## Unit tests (`lib/`)

| Target | Cases |
|---|---|
| `lib/pdf/extract.ts` | `[PAGE N]` markers inserted per page; correct `pageCount`; whitespace normalised |
| `lib/pdf/tokens.ts` | `estimateTokens` ≈ chars/4; `countWords` correct; boundary at 15,000 / 100 |
| `lib/openai/extract.service.ts` | valid JSON parsed; **repair retry** fires exactly once on bad JSON; confidence clamped to [0,1]; missing page → null |
| `lib/utils/confidence.ts` | band thresholds: 0.80→high, 0.50→medium, 0.49→low; colour mapping |
| `lib/prompts/chat.prompt.ts` | `classifyQuery` returns contract/history/both on representative inputs |
| `lib/validation/schemas.ts` | upload, custom-terms (≤5), chat message (≤2000), feedback schemas accept/reject correctly |

Coverage target: ≥ 80% of `lib/`.

## Integration tests (API routes + Supabase)

Run against a test Supabase project (or local stack). OpenAI **mocked** (success, timeout→retry,
malformed JSON→repair).

| Suite | Assertions |
|---|---|
| **RLS isolation (critical)** | User A cannot SELECT/UPDATE/DELETE user B's `contracts`, `key_terms`, `chat_sessions`, `chat_messages`, `user_feedback`; Storage path of B is unreadable by A |
| `upload` | valid PDF → row + `[PAGE N]` text; scanned/oversize rejected with correct code; Storage failure → `file_path` null, request still 201 |
| `process` | standard terms returned; custom terms flagged `is_manual`; low-confidence persisted; `status` transitions uploaded→processing→complete; OpenAI outage → `status='error'` + 502; re-process deletes prior terms |
| `chat` | grounded answer persisted; absent-topic → "I cannot find this in the document."; history ordered ascending; rate limit → 429 |
| `key-terms PATCH` | `is_edited=true`, `ai_original_value` preserved, 403 for non-owner |
| `contracts DELETE` | cascade removes children + Storage object; 403 for non-owner |
| `feedback` | append-only insert; 403 for non-owner |

## E2E tests (Playwright — critical flows)

1. **Auth:** sign up → verify (test inbox) → dashboard empty state; sign out; protected-route redirect.
2. **Core review:** upload sample NDA → process → results show terms with page/confidence → click page ref scrolls viewer → inline edit shows "Edited" badge.
3. **Chat groundedness (regression):** ask an in-document question (gets `[Page X]`); ask an out-of-document question (gets exactly "I cannot find this in the document.").
4. **Dashboard:** processed contract appears; sort by type; delete removes it.
5. **Fallback:** with Storage disabled, results page renders the text viewer and page navigation works.

## Offline AI evaluation suite (PRD §10)

Script over labelled contracts (30 NDA + 20 MSA + CUAD subset). Columns per PRD:
`Contract_ID | Contract_Type | Term_Name | Expected_Value | AI_Extracted_Value | Expected_Page | AI_Page | Confidence_Score | F1_Match | Expert_Rating | Notes`.

| Eval | Target | Cadence |
|---|---|---|
| Extraction F1 | ≥ 88% NDA / ≥ 85% MSA | every release |
| Page accuracy | ≥ 92% | every release |
| Custom-term F1 | ≥ 80% (10 terms × 15 contracts) | every release |
| Confidence calibration | error ≤ 0.10 (10% buckets) | monthly |
| Chat groundedness | ≤ 5% hallucinated (50 Q&A, expert-scored) | monthly |
| End-to-end latency | ≤ 30 s P95 | every release |

CI: regression suite on every deploy; **alert if the 7-day correction rate (`term_corrections`) > 12%** → prompt review.

## Acceptance-criteria matrix (traceability)

| Story | Verified by |
|---|---|
| US-001 auth | E2E #1 |
| US-002 upload+extract | integration `upload`, E2E #2 |
| US-003 page attribution | E2E #2, integration `process` |
| US-004 confidence | unit `confidence`, integration `process` |
| US-005 custom terms | integration `process` |
| US-006 viewer | E2E #2, #5 |
| US-007 chat | E2E #3, integration `chat` |
| US-008 dashboard | E2E #4 |
| US-009 inline edit | E2E #2, integration `key-terms PATCH` |
| US-010 feedback | integration `feedback` |
| US-012 chat history | integration `chat` (ordering), E2E #3 |
| FR-11 low-confidence | unit + E2E #2 |
| FR-13 RLS | integration RLS isolation |
| FR-14 single SQL | `supabase-schema.sql` runs clean (manual + CI) |

## Launch gates (PRD §11)

- **Alpha:** core upload→extract→display works end-to-end, no crashes; disclaimer present.
- **Beta (≤50 users):** no P0 bugs; latency ≤ 45 s P95; F1 ≥ 82%; correction rate ≤ 20%.
- **Public:** F1 ≥ 88% NDA / 85% MSA; latency ≤ 30 s P95; RLS verified; calibration ≤ 0.10; security audit passed.
