# Spec — Key Term Extraction (GPT-4o)

**Implements:** US-003, US-004, US-005, US-011-partial · FR-04, FR-05, FR-11 · engineering-doc §8 · PRD §7–9
**Files:** `app/api/contracts/[id]/process/route.ts`, `lib/openai/{client,extract.service}.ts`,
`lib/prompts/{extraction.prompt,term-libraries}.ts`, `lib/utils/{confidence,errors,rate-limit}.ts`,
`lib/validation/schemas.ts`

## User stories

- **US-011p / FR-04:** see Term Name · Value · Page · Confidence for each term.
- **US-003:** each term shows the page it was found on.
- **US-004 / FR-11:** confidence score per term; < 50% flagged, never hidden.
- **US-005 / FR-05:** add up to 5 custom terms before processing; results include them identically.

## Trigger — `POST /api/contracts/[id]/process`

Runtime: **Node**. Request body: `{ custom_terms?: string[] }` (≤ `MAX_CUSTOM_TERMS` = 5).

**Algorithm:**
```
1. Session (401). Load contract by id via server client (RLS → 404 if not owner).
2. Guard: status === 'processing' → 409 ALREADY_PROCESSING.
3. Validate custom_terms: array, ≤ 5, each 1–60 chars, trimmed, de-duped.
4. Rate limit: enforce RATE_LIMIT_PROCESS_PER_HOUR per user → 429 RATE_LIMITED.
5. UPDATE contracts.status = 'processing'.
6. terms = STANDARD_TERMS[contract.contract_type] ++ custom_terms
7. result = await extractKeyTerms(contract.contract_text, contract.contract_type, terms)
      - GPT-4o, JSON mode, temp 0.1, max_tokens 2000, user: <hashed user_id>
      - on JSON parse failure → ONE repair retry, then 422 EXTRACTION_PARSE_FAILED
      - on OpenAI error → 3× exponential backoff; final failure → set status='error', 502 OPENAI_UNAVAILABLE
8. Validate each term against schema; clamp confidence to [0,1]; default missing page to null.
9. Persist: DELETE existing key_terms for contract (idempotent re-process), INSERT rows
      { contract_id, user_id, term_name, value, ai_original_value:value, page_number,
        confidence_score, source_sentence, is_manual: term ∈ custom_terms }
10. UPDATE contracts.status = 'complete', last_accessed_at = now().
11. Return 200 { contract_id, status:'complete', key_terms:[...] }
```

## Term libraries — `lib/prompts/term-libraries.ts`

```
STANDARD_TERMS = {
  NDA: ['Parties','Effective Date','Confidentiality Obligations','Permitted Disclosures',
        'Term & Duration','Governing Law','Jurisdiction','IP Ownership','Non-Solicitation','Breach & Remedy'],
  MSA: ['Parties','Service Scope','Payment Terms','Invoice Schedule','Late Payment Penalty','Liability Cap',
        'Indemnification','IP Ownership','Termination Clause','Governing Law','Dispute Resolution','Notice Period'],
}
```

## Prompt strategy — `lib/prompts/extraction.prompt.ts`

- **Technique:** few-shot — 3 labelled NDA + 3 MSA examples embedded in the system prompt.
- **System prompt (essentials):** "You are a contract-analysis assistant. Extract ONLY the requested
  terms from the contract text provided. Use ONLY the document text — never general knowledge. For each
  term return the value, the 1-indexed page number (from the nearest `[PAGE N]` marker), a
  confidence_score 0.0–1.0 reflecting your certainty, and the verbatim source_sentence you drew the
  value from. If a term is absent, return value:"Not specified", confidence_score ≤ 0.2, source_sentence:"".
  Return ONLY a JSON object — no prose."
- **Response format:** `response_format: { type: 'json_object' }`. Ask for `{ "terms": [ { term_name,
  value, page_number, confidence_score, source_sentence } ] }` (JSON mode requires an object root).
- **Custom terms:** appended to the target list zero-shot with the same schema; flagged `is_manual` on persist.
- **Confidence:** self-reported inline (no second call).
- **Repair retry:** on `JSON.parse` failure send "Your previous response was not valid JSON. Return
  only the JSON object, no explanation." exactly once.

## `lib/openai/extract.service.ts`
```
extractKeyTerms(contractText, contractType, termNames): Promise<ExtractedTerm[]>
```
Builds messages, calls `openai.chat.completions.create`, parses `terms`, coerces types, returns.
`ExtractedTerm = { term_name, value, page_number:number|null, confidence_score:number, source_sentence:string }`.

## Confidence mapping — `lib/utils/confidence.ts`
```
confidenceBand(score): 'high' | 'medium' | 'low'
   score >= 0.80 → 'high'   (Green 500)
   score >= 0.50 → 'medium' (Yellow 500)
   else          → 'low'    (Red 500, ⚠️, non-dismissible tooltip)
confidenceColor(band) → design-token hex
```
UI consumption is in `results-and-viewer.md`. Percentages shown as `Math.round(score*100)`.

## Cost, latency, reliability

- Target ≤ $0.20 extraction / ≤ $0.25 total per 20-page contract; ≤ 30 s P95 to first display.
- `user` param = hashed `user_id` on every call (GDPR; abuse tracing).
- 3× retry with exponential backoff on 429/5xx from OpenAI; per-user rate limiting on this route.
- No training opt-in.

## Edge cases

| Case | Handling |
|---|---|
| Model returns non-JSON | one repair retry → else 422 `EXTRACTION_PARSE_FAILED`, status stays `error`, user can retry |
| Term absent in contract | value "Not specified", low confidence, empty source_sentence — shown with ⚠️, not hidden |
| Confidence out of range | clamp to [0,1] server-side |
| page_number missing/invalid | store null; UI shows "—" and disables the page-jump link |
| > 5 custom terms | 422 `TOO_MANY_CUSTOM_TERMS` |
| Duplicate custom term equal to a standard term | de-duped case-insensitively before sending |
| Re-process an already-complete contract | allowed; prior key_terms deleted first (idempotent); edited values are overwritten (documented tradeoff) |
| OpenAI timeout / outage | 3 retries → `status='error'`, 502 `OPENAI_UNAVAILABLE`, "Try again in a few minutes." Retry without re-upload. |
| source_sentence not found verbatim in text | still stored; viewer falls back to page-level highlight (no span) |

## Acceptance criteria

- [ ] Processing a valid NDA returns all 10 standard NDA terms (MSA: all 12), each with value, page, confidence 0–1, source_sentence.
- [ ] ≥ 80% of standard terms have a non-empty value on a well-formed contract (PRD US-002 AC).
- [ ] Up to 5 custom terms are extracted with `is_manual = true` and the same structure.
- [ ] Terms with confidence < 0.50 are persisted (never dropped) and surfaced with ⚠️.
- [ ] Malformed model output triggers exactly one repair retry before erroring.
- [ ] OpenAI failure sets `status='error'`, returns a retryable 502, and re-processing works without re-upload.
- [ ] First key-term display ≤ 30 s P95 for ≤ 20-page contracts.
