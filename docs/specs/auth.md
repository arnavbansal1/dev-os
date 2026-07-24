# Spec — Authentication & Session

**Implements:** US-001 · FR-01 · engineering-doc §5/§6
**Files:** `lib/supabase/{browser,server,service}.ts`, `middleware.ts`, `app/(auth)/login/page.tsx`,
`app/(auth)/signup/page.tsx`, `components/ui/AuthForm.tsx`, `app/api/auth/signout/route.ts`

## User story

> As a founder, I want to sign up with email and password so that my contracts and chat history are
> saved privately. — Auth completes ≤ 10 s; redirect to Dashboard on success; invalid credentials show
> a clear error.

## Auth model

Supabase Auth, **email/password** only at MVP. Session stored in cookies via `@supabase/ssr`.
Email verification enabled (Supabase default). No social providers, no magic links at MVP.

## Supabase clients (three)

| File | Client | Use |
|---|---|---|
| `lib/supabase/browser.ts` | `createBrowserClient` | Client Components: sign in/up/out, RLS-scoped reads, Realtime |
| `lib/supabase/server.ts` | `createServerClient` (cookie-bound) | Server Components + Route Handlers: resolve session, RLS-scoped queries |
| `lib/supabase/service.ts` | `createClient` with `SUPABASE_SERVICE_ROLE_KEY` | **SERVER ONLY** privileged writes (e.g. insert with explicit `user_id`). Never imported by client code. |

## Flows

### Sign up (US-001)
```
/signup → AuthForm (email, password, confirm)
  → browser: supabase.auth.signUp({ email, password, options:{ emailRedirectTo: `${SITE_URL}/dashboard` } })
  → Supabase sends verification email
  → UI: "Check your email to verify your account." On verify → session → redirect /dashboard
```

### Sign in
```
/login → AuthForm (email, password)
  → browser: supabase.auth.signInWithPassword({ email, password })
  → success: router.replace('/dashboard')
  → failure: inline error "Invalid email or password."
```

### Sign out
`POST /api/auth/signout` → server client `supabase.auth.signOut()` → clear cookies → redirect `/`.
(Alternatively `supabase.auth.signOut()` from the browser client + redirect.)

## Route protection — `middleware.ts`

Replace the foundation passthrough with a Supabase session check:

```
export async function middleware(request) {
  const { supabase, response } = createMiddlewareClient(request)  // @supabase/ssr pattern
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))
  return response  // also refreshes the session cookie
}
export const config = { matcher: ['/dashboard/:path*','/review/:path*','/contracts/:path*','/settings/:path*','/profile/:path*'] }
```

Public routes: `/`, `/login`, `/signup`. All `/api/*` routes independently resolve the session and
return `401 { error:{ code:'UNAUTHENTICATED', ... } }` when absent (middleware matcher does not cover
`/api`).

## Frontend

- `AuthForm` is a Client Component (`'use client'`) — it needs state + submit handlers.
- Design system: brand-blue primary button, grey-100 input borders, Blue-500 focus ring, plain-English
  error copy. Inter Display. Loading state disables the button and shows a spinner.
- UX states: idle / submitting / error (invalid creds, network) / success (redirect).

## Edge cases

| Case | Handling |
|---|---|
| Invalid credentials | Inline "Invalid email or password." — never reveal which field is wrong |
| Unverified email tries to sign in | Show "Please verify your email first — check your inbox." + resend link |
| Duplicate signup email | "An account with this email already exists. Sign in instead." |
| Weak password | Client-side min length (Supabase default 6) with inline hint before submit |
| Session expired mid-session | Middleware redirects to `/login`; API routes return 401 → client redirects |
| Network failure | "Something went wrong. Please try again." + retry |

## Acceptance criteria

- [ ] Sign up → verify → land on `/dashboard` with an empty state.
- [ ] Sign in with valid creds redirects to `/dashboard` within 10 s.
- [ ] Invalid creds show a clear inline error and do not redirect.
- [ ] Visiting `/dashboard` (or any protected route) while signed out redirects to `/login`.
- [ ] Sign out clears the session and returns to `/`.
- [ ] `service.ts` is never imported in a Client Component (lint/review check).
