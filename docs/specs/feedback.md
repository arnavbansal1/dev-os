# Spec — Feedback Submission

**Implements:** US-010 · FR-12 · engineering-doc §9/§10 · PRD §11 (feedback loop)
**Files:** `components/results/FeedbackWidget.tsx`, `app/api/feedback/route.ts`

## User story

> As a user, I want to submit feedback on the AI's accuracy so the product improves. — Thumbs up/down +
> optional comment on the results page, saved to `user_feedback`.

## UI — `FeedbackWidget` (on the results page)

- Thumbs-up / thumbs-down buttons (mutually exclusive) + optional comment textarea + Submit.
- After submit: replace with "Thanks for the feedback." (idempotent — a user may update by re-submitting;
  simplest MVP: allow multiple rows, analyse latest).
- Design system: brand-blue submit, grey ghost thumbs that fill Green (up) / Red (down) when selected.

## `POST /api/feedback`

Request: `{ contract_id: string, rating: 'up' | 'down', comment?: string }`.
```
1. Session (401). Validate: rating ∈ {up,down}; comment ≤ 1000 chars; contract owned by user (RLS) → 403 otherwise.
2. INSERT user_feedback { user_id, contract_id, rating, comment }.
3. Return 201 { id }.
```
`user_feedback` is append-only (no UPDATE/DELETE policy).

## Edge cases

| Case | Handling |
|---|---|
| Submit without selecting a rating | Disable Submit until a thumb is chosen (client) → 422 `RATING_REQUIRED` (server guard) |
| Comment too long | 422 `COMMENT_TOO_LONG` |
| Feedback on a not-owned contract | 403 `NOT_OWNER` |
| Double submit | Allowed (append-only); analytics use the latest per contract |

## Acceptance criteria

- [ ] Thumbs up/down + optional comment submits and writes a `user_feedback` row with `user_id`, `contract_id`, `rating`, `comment`, timestamp.
- [ ] Submit is blocked until a rating is chosen.
- [ ] Feedback cannot be written for another user's contract.
- [ ] Widget confirms submission.
