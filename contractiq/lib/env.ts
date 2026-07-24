/**
 * Centralised, typed access to environment variables with sane defaults.
 * Server-only secrets are read lazily so client bundles never touch them.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function int(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? n : fallback
}

function float(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Public (browser-safe) config.
 *
 * A missing Supabase URL or anon key used to fall back to `''`, producing a
 * client that silently failed every auth and RLS call instead of failing loudly.
 * These now assert — but LAZILY, via getters.
 *
 * The laziness is load-bearing, not stylistic. `next build` imports every route
 * module while collecting page data, so validating at module-evaluation time
 * fails the build on any environment that injects config at runtime rather than
 * build time (Netlify, Docker, CI). Deferring to first access moves the error to
 * the first request that actually needs the value, which is where a
 * misconfiguration should surface.
 *
 * On the client these are inlined by Next at build time, so a throw would only
 * surface as a hydration error — the server-side assertion is the real gate.
 */
function publicRequired(name: string, value: string | undefined): string {
  if (!value) {
    if (typeof window === 'undefined') {
      throw new Error(`Missing required environment variable: ${name}`)
    }
    console.error(`[env] missing ${name} — the app is misconfigured.`)
    return ''
  }
  return value
}

export const publicEnv = {
  get supabaseUrl() {
    return publicRequired('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
  },
  get supabaseAnonKey() {
    return publicRequired('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  },
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
}

/** Server-only config. Never import into a Client Component. */
export const serverEnv = {
  get supabaseServiceRoleKey() {
    return required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY)
  },
  get openaiApiKey() {
    return required('OPENAI_API_KEY', process.env.OPENAI_API_KEY)
  },
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o',
  openaiMaxTokensExtract: int('OPENAI_MAX_OUTPUT_TOKENS_EXTRACT', 2000),
  openaiMaxTokensChat: int('OPENAI_MAX_OUTPUT_TOKENS_CHAT', 1000),
  openaiTempExtract: float('OPENAI_TEMPERATURE_EXTRACT', 0.1),
  openaiTempChat: float('OPENAI_TEMPERATURE_CHAT', 0.4),
}

/** Application limits (align with engineering-doc §5 / .env.example). */
export const limits = {
  maxUploadBytes: int('MAX_UPLOAD_BYTES', 10_485_760),
  maxPdfPages: int('MAX_PDF_PAGES', 20),
  maxContractTokens: int('MAX_CONTRACT_TOKENS', 15_000),
  maxCustomTerms: int('MAX_CUSTOM_TERMS', 5),
  minExtractedWords: int('MIN_EXTRACTED_WORDS', 100),
  signedUrlTtlSeconds: int('SIGNED_URL_TTL_SECONDS', 3600),
  /** Max chat message length, in characters. */
  maxMessageLength: int('MAX_MESSAGE_LENGTH', 2000),
  /** Max prior chat turns loaded from the database per request. */
  maxChatHistory: int('MAX_CHAT_HISTORY', 100),
  rateLimitProcessPerHour: int('RATE_LIMIT_PROCESS_PER_HOUR', 20),
  rateLimitChatPerMinute: int('RATE_LIMIT_CHAT_PER_MINUTE', 10),
  rateLimitUploadPerDay: int('RATE_LIMIT_UPLOAD_PER_DAY', 20),
}
