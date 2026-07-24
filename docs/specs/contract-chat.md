# Spec — Contract Chat (Grounded Q&A)

**Implements:** US-007, US-012 · FR-08, FR-09 · engineering-doc §4 (Flow 4), §8 · PRD §7–9 · assumptions 11, 14
**Files:** `app/api/contracts/[id]/chat/route.ts`, `app/api/contracts/[id]/messages/route.ts`,
`lib/openai/chat.service.ts`, `lib/prompts/chat.prompt.ts`, `components/chat/{ChatPanel,MessageList,Composer,Citation}.tsx`,
`hooks/useChat.ts`

## User stories

- **US-007 / FR-08:** ask questions in plain English; answers grounded in the document with a page citation; ≤ 15 s.
- **US-012 / FR-09:** chat history persists; reopening a contract loads the prior conversation.

## Grounding model (the trust guarantee)

- **Full-context, no RAG at MVP:** the entire `contracts.contract_text` (≤ 15k tokens) is passed on
  every turn — no chunking/embeddings. Guarantees no clause is missed by retrieval error.
- **Document-only:** system prompt forbids general knowledge; "I cannot find this in the document" is a
  correct answer when info is absent.
- **Mandatory `[Page X]` citation** on every answer; **"Based on the document…"** framing prefix.
- **Conversation memory:** load up to **200** messages ascending and pass them as the message array
  (enables "what did you say earlier about X?").
- **Query classification** (`contract` | `history` | `both`): a lightweight in-prompt/local heuristic
  step that adjusts the system prompt and context inclusion **without an extra API call**.

## `POST /api/contracts/[id]/chat`

Runtime: **Node**. Request: `{ message: string }` (1–2000 chars).

**Algorithm:**
```
1. Session (401). Load contract by id (RLS → 404 if not owner). Bump last_accessed_at.
2. Validate message (non-empty, ≤ 2000 chars).
3. Rate limit: RATE_LIMIT_CHAT_PER_MINUTE per user → 429 RATE_LIMITED.
4. Ensure chat_sessions row for contract (create if missing). INSERT user message.
5. history = SELECT chat_messages WHERE session ORDER BY created_at ASC LIMIT 200.
6. queryType = classifyQuery(message, history)   // 'contract'|'history'|'both', local heuristic
7. answer = await chatWithContract(contract.contract_text, history, message, queryType)
      - GPT-4o, temp 0.4, max_tokens 1000
      - system prompt enforces document-only + [Page X] + "Based on the document…"
      - 3× backoff on OpenAI error → 502 OPENAI_UNAVAILABLE
8. INSERT assistant message (content includes [Page X]).
9. Return 200 { message: { role:'assistant', content, created_at } }.
```

## `GET /api/contracts/[id]/messages`

Returns `{ session_id, messages: [{ role, content, created_at }] }` ascending. Called on results-page
mount to hydrate `ChatPanel` (US-012). Empty when no session yet.

## Prompt — `lib/prompts/chat.prompt.ts`

System prompt (essentials):
> "You are ContractIQ's assistant. Answer the user's question using ONLY the contract text provided
> below. Do not use general legal knowledge. Begin answers with 'Based on the document,'. Always end
> with a page citation in the form `[Page X]` referencing the `[PAGE N]` markers. If the answer is not
> in the document, reply exactly: 'I cannot find this in the document.' Keep answers concise."
Then: the full contract text, then the conversation history, then the new user message.

`classifyQuery` (local): if the message references the conversation ("earlier", "you said", "before")
→ `history`; if it references the contract → `contract`; ambiguous → `both`. Controls whether the full
contract text and/or extended history are emphasised (all still passed; classification tunes the prompt).

## Frontend — `ChatPanel`

- Client Component. `MessageList` (user right-aligned, assistant left-aligned), `Composer` (textarea +
  send), typing indicator while awaiting.
- `Citation` parses `[Page X]` in assistant messages into a clickable chip → sets viewer `targetPage`
  (shares `useContractSession.setTargetPage` with the terms panel).
- **Persistence + Realtime:** messages saved server-side; optionally subscribe via Supabase Realtime on
  `chat_messages` (filtered by `session_id`) to stream inserts. On mount, hydrate from `GET …/messages`.
- Design system: brand-blue user bubbles, grey-50 assistant bubbles, Inter Display, flat.

## Edge cases

| Case | Handling |
|---|---|
| Answer absent in document | "I cannot find this in the document." — expected, not an error |
| Model omits `[Page X]` | Server appends a soft note or re-prompts once; assistant message still saved |
| Empty / whitespace message | 422 `EMPTY_MESSAGE`; not sent to OpenAI |
| Message > 2000 chars | 422 `MESSAGE_TOO_LONG` |
| History > 200 messages | Oldest truncated (keep latest 200 ascending) |
| OpenAI timeout/outage | 3 retries → 502 `OPENAI_UNAVAILABLE`, "Try again in a few minutes." User message is kept; assistant not written |
| Contract still processing | Chat disabled with hint "Finish processing to chat with this contract." |
| Realtime unavailable | Fall back to the POST response (no streaming); UX unaffected |

## Acceptance criteria

- [ ] A question answerable from the document returns a grounded answer with a `[Page X]` citation, ≤ 15 s.
- [ ] A question about an absent topic returns exactly "I cannot find this in the document." (hallucination regression test).
- [ ] Clicking a `[Page X]` citation scrolls the viewer to that page.
- [ ] Every message (user + assistant) is persisted with role + timestamp.
- [ ] Reopening the contract loads the full prior conversation in order.
- [ ] Memory question ("what did you say earlier about X?") is answered from history.
