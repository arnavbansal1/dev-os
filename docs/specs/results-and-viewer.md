# Spec — Results Page, Document Viewer & Inline Editing

**Implements:** US-003, US-006, US-009, US-011-partial · FR-04, FR-06, FR-07, FR-11 · engineering-doc §4/§5/§9 · PRD §9 (guardrails)
**Files:** `app/contracts/[id]/page.tsx`, `components/results/{KeyTermsPanel,TermRow,ConfidenceBadge,LowConfidenceWarning,WhyDisclosure,InlineEditor,NotLegalAdviceDisclaimer,FeedbackWidget}.tsx`,
`components/viewer/{DocumentViewer,PdfViewer,TextViewer}.tsx`, `hooks/{useContractSession,useKeyTerms}.ts`,
`app/api/contracts/[id]/route.ts`, `app/api/key-terms/[id]/route.ts`

## Layout

Two-panel (engineering-doc §4 Flow 3). Left: `DocumentViewer`. Right: `KeyTermsPanel` + `ChatPanel`
(chat spec is separate). `NotLegalAdviceDisclaimer` always visible above the panels. On mobile the two
panels collapse to tabs.

## Data load — `GET /api/contracts/[id]`

Returns `{ contract, key_terms[], signed_url?, page_count }`. `signed_url` is a 1-hour Storage signed
URL when `file_path` is set, else `null` (→ text-viewer fallback). Also bumps `last_accessed_at`.
`hooks/useContractSession` holds `{ contract, keyTerms, targetPage, setTargetPage }` and coordinates
the panels.

## Document viewer

`DocumentViewer` picks the renderer:
- **`signed_url` present → `PdfViewer`** (PDF.js / `pdfjs-dist`, Client Component). Scroll + zoom;
  lazy-load pages; render extracted-term highlight spans; expose an imperative `scrollToPage(n)`.
- **`signed_url` null → `TextViewer`** (fallback). Splits `contract.contract_text` on `[PAGE N]`
  markers, renders each page as a labelled `<section id="page-{n}">`, supports the same page jump.

Both accept a `targetPage` prop and respond to changes (FR-06/07): setting `targetPage` scrolls to that
page and briefly highlights it (Blue-50 flash, 300 ms). A "Download PDF" link is shown as a last resort
if PDF.js fails to render (PRD external dependency mitigation).

## Key terms panel

`KeyTermsPanel` renders one `TermRow` per term:
```
[Term Name (16/500, grey-900)]        [ConfidenceBadge]
[Value (16/500) — click to edit]      [Page N →]   [Why? ▸]
```
- **`ConfidenceBadge`** — `confidenceBand()` → Green/Yellow/Red badge showing `Math.round(score*100)%`
  (design.md status-badge pattern). Colour + icon, never colour alone (a11y).
- **`LowConfidenceWarning`** — when band = 'low': ⚠️ + non-dismissible tooltip *"Low confidence — we
  recommend verifying this in the document directly."* Also drives the viewer to auto-highlight the
  nearest page span on row focus.
- **`Page N →`** — click sets `targetPage = page_number` (scrolls viewer). Disabled + shows "—" when
  `page_number` is null.
- **`WhyDisclosure`** — expandable "Why?" reveals the verbatim `source_sentence`. Empty → "No supporting
  sentence found — verify manually."
- **`InlineEditor`** — see below.

Default view prioritises the 10–12 most material terms (PRD HHH: avoid overload); custom/low-confidence
terms remain visible.

## Inline editing — `PATCH /api/key-terms/[id]` (US-009)

- Click a term value → `InlineEditor` (text input, Save/Cancel).
- `PATCH { value }` → server verifies ownership (RLS + explicit check), sets `value`, `is_edited=true`;
  **`ai_original_value` is never overwritten** (preserved for the feedback loop).
- Optimistic UI; save target ≤ 2 s. On success an **"Edited"** badge appears on the row.
- Error → revert to previous value + toast.

## Hallucination / trust UI (PRD §9)

- `NotLegalAdviceDisclaimer`: *"This is an AI-assisted review tool, not legal advice. Always verify
  critical terms with a qualified lawyer."* — present on every results page.
- Low-confidence auto-highlight in the viewer.
- Source sentence per term via "Why?".

## UX states

| State | Handling |
|---|---|
| Loading | Skeleton rows in the panel; viewer shows a page-loading shimmer |
| Processing (`status='processing'`) | Show the 3-step progress stepper; poll `GET /api/contracts/[id]` until `complete`/`error` |
| Error (`status='error'`) | Banner "Analysis failed." + "Retry" → re-`POST /process` (no re-upload) |
| Storage down (`signed_url` null) | Text viewer renders; small banner "PDF preview unavailable — analysis unaffected." |
| Empty page_number | "—", jump disabled |
| Responsive | Panels → tabs on < 768px |
| a11y | Keyboard-navigable rows, focus ring Blue-500, ARIA on badges/tooltips/disclosure |

## Edge cases

| Case | Handling |
|---|---|
| PDF.js render failure | Show "Download PDF" fallback link; log; offer text viewer |
| `targetPage` beyond page_count | Clamp to `[1, page_count]` |
| Editing to empty string | Allowed but warn; store as entered (user intent) |
| Concurrent edits (two tabs) | Last write wins; `updated_at` reflects latest |
| Re-process overwrites an edited term | Documented in `key-term-extraction.md`; consider a confirm dialog before re-process (future) |

## Acceptance criteria

- [ ] Results page shows every term with Name · Value · Page · Confidence, colour-coded correctly.
- [ ] Clicking a page reference scrolls the viewer to that page with a highlight (both PDF and text viewers).
- [ ] Terms < 50% show ⚠️ + tooltip and are never hidden.
- [ ] "Why?" reveals the verbatim source sentence.
- [ ] Inline edit saves ≤ 2 s, shows an "Edited" badge, and preserves `ai_original_value`.
- [ ] With `file_path` null, the text-viewer fallback renders and page navigation still works.
- [ ] The not-legal-advice disclaimer is visible on the page.
