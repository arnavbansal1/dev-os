# Spec — Dashboard & Contract History

**Implements:** US-008 · FR-10, FR-13 · engineering-doc §4 (Flows 1–2), §9 · PRD §5 (retention/GDPR)
**Files:** `app/dashboard/page.tsx`, `components/dashboard/{SummaryCard,ContractTable,EmptyState}.tsx`,
`app/api/contracts/route.ts` (GET list), `app/api/contracts/[id]/route.ts` (DELETE)

## User story

> As a user, I want my dashboard to show all the contracts I've reviewed so I have a record. — Shows
> name, type, date, status; clicking a row opens the results page.

## Data load — `GET /api/contracts`

Returns:
```
{
  total: number,
  by_type: { NDA: number, MSA: number },
  contracts: [ { id, name, contract_type, status, created_at } ]   // RLS-scoped, newest first
}
```
Backed by the `idx_contracts_user_created` index. Server Component may query Supabase directly with the
server client (RLS applies) instead of calling the route.

## UI

- **`SummaryCard`** — total contracts processed, NDA vs MSA breakdown, last 5 reviewed (name + status +
  date). Prominent **"Review a Contract"** CTA → `/review`.
- **`ContractTable`** — sortable by date / name / type (client-side sort of the fetched list). Columns:
  Name · Type (badge) · Date · Status (badge) · row → `/contracts/[id]`. Per-row overflow menu: Delete.
- **`EmptyState`** — first visit: *"No contracts reviewed yet — upload your first contract to begin."* +
  CTA (engineering-doc Flow 1).

Design system: white cards on grey-25 page, grey-100 dividers, status badges (uploaded=grey,
processing=yellow, complete=green, error=red), Inter Display, flat depth.

## Delete — `DELETE /api/contracts/[id]` (GDPR)

```
1. Session (401). Verify ownership (RLS + explicit check) → 403/404 otherwise.
2. If file_path set: delete Storage object contracts/{user_id}/{id}/... (best-effort; log on failure).
3. DELETE contracts row → cascades to key_terms, chat_sessions, chat_messages, user_feedback.
4. Return 204.
```
UI: confirm dialog ("Delete this contract and all its data? This can't be undone."), optimistic removal
from the table, toast on success/failure.

## Status badges

| status | badge | meaning |
|---|---|---|
| `uploaded` | grey | text extracted, not yet processed |
| `processing` | yellow | GPT-4o extraction in progress |
| `complete` | green | key terms ready |
| `error` | red | extraction failed — open to retry |

## Edge cases

| Case | Handling |
|---|---|
| No contracts | `EmptyState` |
| Row with `status='error'` | Opens results page showing the retry banner |
| Row with `status='processing'` | Opens results page with the progress stepper (polls) |
| Delete Storage object missing | Ignore (already gone); still delete the row |
| Large history | Client sort is fine at MVP volumes; pagination is a future enhancement |
| Sort stability | Secondary sort by `created_at desc` to keep order deterministic |

## Acceptance criteria

- [ ] Dashboard shows total, NDA/MSA breakdown, and a sortable list of the user's contracts.
- [ ] Sorting by date, name, and type works and is stable.
- [ ] Clicking a row opens that contract's results page.
- [ ] Empty state shows for a new user.
- [ ] Delete removes the contract, all children (cascade), and the Storage object, then updates the UI.
- [ ] A user never sees another user's contracts (RLS).
