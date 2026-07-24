import { createHash } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { AppError } from '@/lib/utils/errors'
import { limits } from '@/lib/env'

/**
 * Durable sliding-window rate limiting backed by Supabase (security-plan §3).
 *
 * Replaces the previous in-process Map, which was unenforceable in production:
 * Next.js route handlers run on short-lived serverless instances, so each cold
 * start began with an empty counter and concurrent instances each kept their own
 * — an attacker could exceed any limit simply by spreading requests, and a
 * redeploy reset every window. Counts now live in `rate_limit_events`.
 *
 * All reads and writes use the service-role client so a user cannot delete or
 * forge their own counter rows; the table carries no user-facing RLS policy.
 *
 * Counters are keyed by an opaque `identifier` string rather than a `user_id`
 * foreign key, because the login limiter has to run BEFORE a user exists — it
 * keys on a hashed client IP instead.
 */

export type RateLimitAction = 'auth' | 'chat' | 'process' | 'upload'

export interface RateLimitRule {
  /** Max events permitted inside the window. */
  limit: number
  /** Sliding window length, in seconds. */
  windowSeconds: number
}

/** Per-action limits. Values are env-tunable where an override already exists. */
export const RATE_LIMITS: Record<RateLimitAction, RateLimitRule> = {
  auth: { limit: 10, windowSeconds: 60 },
  chat: { limit: limits.rateLimitChatPerMinute, windowSeconds: 60 },
  process: { limit: limits.rateLimitProcessPerHour, windowSeconds: 60 * 60 },
  upload: { limit: limits.rateLimitUploadPerDay, windowSeconds: 60 * 60 * 24 },
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  /** Seconds until the oldest event in the window expires. */
  retryAfterSeconds: number
}

/**
 * Record an attempt and report whether it is within the limit.
 *
 * Counts events in the trailing `windowSeconds`, and only inserts a new row when
 * the request is allowed — so a blocked caller cannot extend their own lockout
 * by hammering the endpoint.
 */
export async function checkRateLimit(
  action: RateLimitAction,
  identifier: string,
  rule: RateLimitRule = RATE_LIMITS[action],
): Promise<RateLimitResult> {
  const service = createServiceClient()
  const windowStart = new Date(Date.now() - rule.windowSeconds * 1000).toISOString()

  const { data, error } = await service
    .from('rate_limit_events')
    .select('created_at')
    .eq('identifier', identifier)
    .eq('action', action)
    .gte('created_at', windowStart)
    .order('created_at', { ascending: true })

  if (error) {
    // Fail CLOSED on OpenAI-spending actions: a rate-limiter outage must not
    // become an unmetered path to our billing. Cheap actions fail open so an
    // infrastructure blip cannot lock everyone out of the product.
    console.error('[security] rate limit lookup failed', { action, message: error.message })
    const failClosed = action === 'chat' || action === 'process' || action === 'upload'
    if (failClosed) {
      return { allowed: false, remaining: 0, retryAfterSeconds: 30 }
    }
    return { allowed: true, remaining: rule.limit, retryAfterSeconds: 0 }
  }

  const events = data ?? []
  if (events.length >= rule.limit) {
    const oldest = new Date(events[0].created_at).getTime()
    const freesAt = oldest + rule.windowSeconds * 1000
    const retryAfterSeconds = Math.max(1, Math.ceil((freesAt - Date.now()) / 1000))
    return { allowed: false, remaining: 0, retryAfterSeconds }
  }

  const { error: insertErr } = await service
    .from('rate_limit_events')
    .insert({ identifier, action })
  if (insertErr) {
    console.error('[security] rate limit insert failed', { action, message: insertErr.message })
  }

  return {
    allowed: true,
    remaining: rule.limit - events.length - 1,
    retryAfterSeconds: 0,
  }
}

/**
 * Enforce a limit, throwing RATE_LIMITED (429) with an accurate `Retry-After`
 * when it is exceeded. Call this BEFORE any expensive or billable work.
 */
export async function enforceRateLimit(
  action: RateLimitAction,
  identifier: string,
  rule?: RateLimitRule,
): Promise<void> {
  const result = await checkRateLimit(action, identifier, rule)
  if (!result.allowed) {
    throw new AppError('RATE_LIMITED', undefined, { retryAfterSeconds: result.retryAfterSeconds })
  }
}

/**
 * Derive a rate-limit key for an unauthenticated caller from its client IP.
 *
 * The IP is hashed before storage: raw addresses are personal data under GDPR,
 * and the limiter only ever needs equality, never the original value. Falls back
 * to a shared bucket when no forwarding header is present — that is intentionally
 * conservative (one shared limit) rather than fail-open.
 */
export function clientIpKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip')?.trim()
  if (!ip) return 'ip:unknown'
  return `ip:${createHash('sha256').update(ip).digest('hex').slice(0, 32)}`
}

/** Rate-limit key for an authenticated user. */
export function userKey(userId: string): string {
  return `user:${userId}`
}
