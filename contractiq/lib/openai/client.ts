import OpenAI from 'openai'
import { serverEnv } from '@/lib/env'
import { AppError } from '@/lib/utils/errors'

let client: OpenAI | null = null

/** Lazily-constructed singleton OpenAI client (server only). */
export function getOpenAI(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: serverEnv.openaiApiKey })
  return client
}

/**
 * Run an OpenAI call with exponential backoff (3 attempts). Retries on 429/5xx
 * and network errors; throws OPENAI_UNAVAILABLE after the final failure.
 */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const status = (err as { status?: number })?.status
      const retryable = status === undefined || status === 429 || (status >= 500 && status < 600)
      if (!retryable || i === attempts - 1) break
      // 500ms, 1000ms, 2000ms …
      await new Promise((r) => setTimeout(r, 500 * 2 ** i))
    }
  }
  console.error('[openai] request failed after retries', lastErr)
  throw new AppError('OPENAI_UNAVAILABLE')
}

/** Stable, non-reversible user id for OpenAI's `user` param (GDPR / abuse tracing). */
export function hashUserId(userId: string): string {
  let h = 0
  for (let i = 0; i < userId.length; i++) {
    h = (Math.imul(31, h) + userId.charCodeAt(i)) | 0
  }
  return `u_${(h >>> 0).toString(16)}`
}
