import { AppError } from '@/lib/utils/errors'
import { limits } from '@/lib/env'

/**
 * Resource and spend ceilings for every user-controlled input that reaches the
 * model or Storage (security-plan §5).
 *
 * These are cost-control boundaries as much as security ones: each is a path
 * where an unbounded user input turns into unbounded OpenAI billing.
 */
export const TOKEN_LIMITS = {
  /** Must match the Storage bucket's `file_size_limit`. */
  maxFileBytes: limits.maxUploadBytes,
  maxPageCount: limits.maxPdfPages,
  maxContractTokens: limits.maxContractTokens,
  maxMessageLength: limits.maxMessageLength,
  /** Turns of prior conversation retrievable from the database. */
  maxChatHistory: limits.maxChatHistory,
  maxCustomTerms: limits.maxCustomTerms,
} as const

export function assertFileSize(bytes: number): void {
  if (bytes > TOKEN_LIMITS.maxFileBytes) throw new AppError('FILE_TOO_LARGE')
}

export function assertPageCount(pages: number): void {
  if (pages > TOKEN_LIMITS.maxPageCount) throw new AppError('TOO_MANY_PAGES')
}

export function assertContractTokens(tokens: number): void {
  if (tokens > TOKEN_LIMITS.maxContractTokens) throw new AppError('CONTRACT_TOO_LONG')
}

/** Validate a chat message's length. Returns the trimmed message. */
export function assertMessageLength(message: string): string {
  const trimmed = message.trim()
  if (!trimmed) throw new AppError('EMPTY_MESSAGE')
  if (trimmed.length > TOKEN_LIMITS.maxMessageLength) throw new AppError('MESSAGE_TOO_LONG')
  return trimmed
}

/**
 * Cap how many prior turns are loaded from the database. Chat history grows
 * without bound, and every turn retrieved is a turn billed on the next request.
 */
export function chatHistoryLimit(): number {
  return TOKEN_LIMITS.maxChatHistory
}
