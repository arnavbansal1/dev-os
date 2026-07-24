# Spec — API Reference (consolidated)

**Implements:** engineering-doc §9 · all FRs
All routes are Next.js **Route Handlers** under `app/api/*`, **Node runtime**, and require an
authenticated Supabase session unless noted. Ownership is enforced by RLS **and** an explicit check
before writes. Feature-level detail lives in the per-feature specs; this is the single contract sheet.

## Error envelope (every route)

```json
{ "error": { "code": "STRING_CODE", "message": "Human-readable, plain English", "retryable": true } }
```
No raw stack traces. Log full errors server-side with a correlation id.

## Standard error codes

| Code | HTTP | retryable | Meaning |
|---|---|---|---|
| `UNAUTHENTICATED` | 401 | false | No valid session |
| `NOT_OWNER` | 403 | false | Resource belongs to another user |
| `NOT_FOUND` | 404 | false | Resource missing / not visible under RLS |
| `VALIDATION_ERROR` | 422 | false | Generic schema failure |
| `RATE_LIMITED` | 429 | true | Per-user limit exceeded (`Retry-After` header) |
| `OPENAI_UNAVAILABLE` | 502 | true | OpenAI failed after 3 retries |
| `INTERNAL` | 500 | true | Unexpected server error |

## Endpoints

### `POST /api/contracts/upload`
Multipart `file` (PDF) + `contract_type` (NDA|MSA). → `201 { contract_id, name, contract_type,
page_count, status:'uploaded', standard_terms:string[], file_available:boolean }`.
Errors: `FILE_TOO_LARGE`(413), `UNSUPPORTED_TYPE`(415), `TOO_MANY_PAGES`(422),
`SCANNED_PDF_UNSUPPORTED`(422), `CONTRACT_TOO_LONG`(422), `PDF_PARSE_FAILED`(422). → `pdf-upload-extraction.md`

### `POST /api/contracts/[id]/process`
`{ custom_terms?: string[≤5] }` → `200 { contract_id, status:'complete', key_terms:KeyTerm[] }`.
Errors: `ALREADY_PROCESSING`(409), `TOO_MANY_CUSTOM_TERMS`(422), `EXTRACTION_PARSE_FAILED`(422),
`RATE_LIMITED`(429), `OPENAI_UNAVAILABLE`(502). → `key-term-extraction.md`

### `GET /api/contracts`
→ `200 { total, by_type:{NDA,MSA}, contracts:[{id,name,contract_type,status,created_at}] }`. → `dashboard.md`

### `GET /api/contracts/[id]`
→ `200 { contract, key_terms:KeyTerm[], signed_url:string|null, page_count }`. Bumps `last_accessed_at`.
Errors: `NOT_FOUND`(404). → `results-and-viewer.md`

### `DELETE /api/contracts/[id]`
→ `204`. Deletes Storage object (best-effort) + row (cascades). Errors: `NOT_OWNER`(403). → `dashboard.md`

### `PATCH /api/key-terms/[id]`
`{ value: string }` → `200 { key_term:KeyTerm }`. Sets `is_edited=true`, preserves `ai_original_value`.
Errors: `NOT_OWNER`(403), `VALIDATION_ERROR`(422). Target ≤ 2 s. → `results-and-viewer.md`

### `POST /api/contracts/[id]/chat`
`{ message: string (1–2000) }` → `200 { message:{ role:'assistant', content, created_at } }`.
Errors: `EMPTY_MESSAGE`(422), `MESSAGE_TOO_LONG`(422), `RATE_LIMITED`(429), `OPENAI_UNAVAILABLE`(502). → `contract-chat.md`

### `GET /api/contracts/[id]/messages`
→ `200 { session_id, messages:[{role,content,created_at}] }` ascending. → `contract-chat.md`

### `POST /api/feedback`
`{ contract_id, rating:'up'|'down', comment?:string(≤1000) }` → `201 { id }`.
Errors: `RATING_REQUIRED`(422), `COMMENT_TOO_LONG`(422), `NOT_OWNER`(403). → `feedback.md`

### `POST /api/auth/signout`
→ `204`, clears session. → `auth.md`

## Cross-cutting rules

- **Auth:** resolve session server-side on every route; 401 if absent (middleware does not cover `/api`).
- **Rate limits:** `/process` = `RATE_LIMIT_PROCESS_PER_HOUR`; `/chat` = `RATE_LIMIT_CHAT_PER_MINUTE`, per user, `Retry-After` set.
- **OpenAI calls:** 3× exponential backoff; `user` param = hashed user_id; caps per engineering-doc §8.
- **Validation:** Zod in `lib/validation/schemas.ts`, shared client/server.
- **Idempotency:** re-`POST /process` deletes prior `key_terms` first; upload always creates a new contract.
