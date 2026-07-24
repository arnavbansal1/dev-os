# ContractIQ

AI-assisted NDA/MSA contract review — extract key terms with page references, confidence scores,
and a document-grounded chat. See `../docs/engineering/engineering-doc.md` for the full design.

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** wired to the allNeurons design system (`../docs/design.md`)
- **Supabase** (Auth · Postgres · Storage · Realtime)
- **OpenAI GPT-4o** (extraction + grounded chat)
- **pdf-parse** (server text extraction) · **PDF.js** (client viewer)

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase + OpenAI keys
npm run dev                  # http://localhost:3000
```

## Structure (foundation)

```
app/            App Router pages + globals.css (design tokens)
components/     ui · upload · results · viewer · chat · dashboard
lib/            supabase · openai · pdf · prompts · validation · utils
hooks/          shared React hooks
types/          core domain types (Contract, KeyTerm, ChatMessage, …)
middleware.ts   route-protection scaffold (wired to Supabase in Stage 4)
```

Feature code is added in Stage 4, one feature at a time, per the engineering doc.
Always apply the design system (`../docs/design.md`) to any UI.
