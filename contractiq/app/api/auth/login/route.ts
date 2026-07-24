import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { enforceRateLimit, clientIpKey } from '@/lib/security/rateLimiter'
import { AppError, handleRoute } from '@/lib/utils/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(200),
})

/**
 * POST /api/auth/login — server-side password sign-in.
 *
 * Exists so that credential attempts pass through OUR rate limiter. When the
 * browser calls `signInWithPassword` directly against Supabase, the application
 * never sees the attempt and cannot throttle credential stuffing; only
 * Supabase's own global limits apply. Cookies are set by the SSR client here.
 */
export async function POST(request: Request) {
  return handleRoute(async () => {
    // Keyed by hashed client IP — there is no authenticated user yet.
    await enforceRateLimit('auth', clientIpKey(request))

    const body = await request.json().catch(() => ({}))
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Enter a valid email and password.')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    })

    if (error) {
      // One generic message for every failure mode. Distinguishing "no such
      // account" from "wrong password" hands an attacker a user-enumeration
      // oracle against the login form.
      console.warn('[auth] sign-in failed', { reason: error.message })
      throw new AppError('UNAUTHENTICATED', 'Invalid email or password.')
    }

    return NextResponse.json({ ok: true })
  })
}
