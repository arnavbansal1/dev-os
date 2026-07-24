# Spec — PDF Upload & Text Extraction

**Implements:** US-002 · FR-02, FR-03 · engineering-doc §4 (Flow 3), §6, Risk B
**Files:** `app/review/page.tsx`, `components/upload/{UploadZone,ContractTypeSelect,TermPreviewList}.tsx`,
`app/api/contracts/upload/route.ts`, `lib/pdf/extract.ts`, `lib/pdf/tokens.ts`,
`lib/validation/schemas.ts`, `lib/supabase/service.ts`

## User story

> As a user, I want to upload a PDF contract and immediately see it accepted (or a clear reason it was
> rejected), so the review can begin. — Accepts ≤ 10 MB PDFs; extraction stored server-side; scanned or
> oversized files rejected with a friendly message.

## Core principle — extract once

Text is extracted **at upload** with `[PAGE N]` markers and stored in `contracts.contract_text`. The
`/process` and `/chat` routes read that column; the PDF file is never re-downloaded for AI work. The
Storage upload is a **separate, non-blocking** step whose only purpose is the inline PDF viewer.

## Frontend — `/review`

1. `ContractTypeSelect` — dropdown NDA | MSA (required before upload).
2. `UploadZone` — drag-drop or file-pick. Client pre-checks: `type === 'application/pdf'`, `size ≤ 10 MB`.
3. On select → `POST /api/contracts/upload` (multipart). Show an uploading state.
4. On success → render `TermPreviewList`: the standard terms for the chosen type (from `lib/prompts/term-libraries.ts`) as chips, plus the custom-term adder (see `key-term-extraction.md`).
5. On rejection → inline error with the returned `message` and a retry affordance.

Design system: dashed grey-200 drop border → brand-blue on drag-over; Inter Display; flat (no shadow).

## Backend — `POST /api/contracts/upload`

Runtime: **Node** (`export const runtime = 'nodejs'`) — `pdf-parse` needs Node APIs.

**Request:** `multipart/form-data` — `file` (PDF), `contract_type` (`NDA`|`MSA`).

**Algorithm:**
```
1. Resolve session (401 if none).
2. Validate: contract_type ∈ {NDA,MSA}; file present; mime = application/pdf; size ≤ MAX_UPLOAD_BYTES.
3. buffer = await file.arrayBuffer()
4. { text, pageCount } = await extractPdf(buffer)   // lib/pdf/extract.ts
5. Guard scanned/image PDF: wordCount(text) < MIN_EXTRACTED_WORDS (100) → 422 SCANNED_PDF_UNSUPPORTED.
6. Guard pages: pageCount > MAX_PDF_PAGES (20) → 422 TOO_MANY_PAGES.
7. tokenCount = estimateTokens(text)   // lib/pdf/tokens.ts (≈ chars/4)
   tokenCount > MAX_CONTRACT_TOKENS (15000) → 422 CONTRACT_TOO_LONG.
8. contractId = uuid
9. INSERT contracts { id:contractId, user_id, name:file.name, contract_type,
                      contract_text:text, page_count, token_count, status:'uploaded' }  (service client, user_id set explicitly)
10. Non-blocking Storage: try upload to contracts/{user_id}/{contractId}/{filename}.pdf
      success → UPDATE contracts.file_path
      failure → log, leave file_path null (do NOT fail the request)
11. Return 201 { contract_id, name, contract_type, page_count, status:'uploaded',
                 standard_terms:string[], file_available:boolean }
```

### `lib/pdf/extract.ts`
```
extractPdf(buffer): { text: string, pageCount: number }
```
Use `pdf-parse` with a custom `pagerender` (or split on the library's page callback) to prepend a
`\n[PAGE {n}]\n` marker before each page's text. `pageCount` from the parsed metadata. Normalise
whitespace but preserve sentence boundaries (needed for `source_sentence` matching downstream).

### `lib/pdf/tokens.ts`
`estimateTokens(text)` — cheap heuristic `Math.ceil(text.length / 4)`; good enough for the 15k guard.
`countWords(text)` — whitespace split length, for the scanned-PDF guard.

## Validation (`lib/validation/schemas.ts`)

```
uploadSchema = z.object({ contract_type: z.enum(['NDA','MSA']) })
// file validated imperatively (size/mime) — not expressible in Zod for a File.
```

## Edge cases

| Case | Handling |
|---|---|
| Scanned/image PDF (text < 100 words) | 422 `SCANNED_PDF_UNSUPPORTED` — "Scanned PDFs are not supported yet." No row stored. |
| > 20 pages | 422 `TOO_MANY_PAGES` — "Contracts up to 20 pages are supported at the moment." |
| > 15,000 tokens | 422 `CONTRACT_TOO_LONG` — "This contract is longer than we support yet." |
| > 10 MB | 413 `FILE_TOO_LARGE` (also blocked client-side and by the Storage bucket limit) |
| Non-PDF mime | 415 `UNSUPPORTED_TYPE` |
| Corrupt/unparseable PDF | 422 `PDF_PARSE_FAILED` — "We couldn't read this PDF. Try re-exporting it." No row stored. |
| Storage upload fails | Contract still created; `file_available:false`; viewer will use text fallback |
| Password-protected PDF | Caught by parse failure → `PDF_PARSE_FAILED` |
| Contract type mismatch (e.g. NDA uploaded as MSA) | Allowed; extraction proceeds (may miss domain terms). Soft warning is a future enhancement (PRD Internal Risks). |

## Acceptance criteria

- [ ] A valid ≤ 10 MB / ≤ 20 page text-layer NDA/MSA is accepted; `contracts` row created with `contract_text` containing `[PAGE N]` markers and correct `page_count`.
- [ ] Scanned PDF (image-only) is rejected with the exact scanned-PDF message; no row stored.
- [ ] Oversize (pages/tokens/bytes) rejected with the matching message and status code.
- [ ] Storage failure does not fail the upload; `file_path` is null and `file_available:false`.
- [ ] Response includes the correct `standard_terms` list for the selected contract type.
- [ ] Text is extracted exactly once — `/process` and `/chat` never re-read the file.
