import { NextResponse } from 'next/server'
import type { ApiError } from '@/types'

/** Canonical error codes → HTTP status + default retryability (api-reference.md). */
export const ERROR_SPECS = {
  UNAUTHENTICATED: { status: 401, retryable: false, message: 'Please sign in to continue.' },
  NOT_OWNER: { status: 403, retryable: false, message: 'You do not have access to this resource.' },
  NOT_FOUND: { status: 404, retryable: false, message: 'Not found.' },
  VALIDATION_ERROR: { status: 422, retryable: false, message: 'The request was invalid.' },
  FILE_TOO_LARGE: { status: 413, retryable: false, message: 'The file is larger than 10 MB.' },
  UNSUPPORTED_TYPE: { status: 415, retryable: false, message: 'Only PDF files are supported.' },
  TOO_MANY_PAGES: { status: 422, retryable: false, message: 'Contracts up to 20 pages are supported at the moment.' },
  SCANNED_PDF_UNSUPPORTED: { status: 422, retryable: false, message: 'Scanned PDFs are not supported yet.' },
  CONTRACT_TOO_LONG: { status: 422, retryable: false, message: 'This contract is longer than we support yet.' },
  PDF_PARSE_FAILED: { status: 422, retryable: false, message: "We couldn't read this PDF. Try re-exporting it." },
  ALREADY_PROCESSING: { status: 409, retryable: true, message: 'This contract is already being processed.' },
  TOO_MANY_CUSTOM_TERMS: { status: 422, retryable: false, message: 'You can add up to 5 custom terms.' },
  EXTRACTION_PARSE_FAILED: { status: 422, retryable: true, message: 'We had trouble reading the analysis. Please try again.' },
  EMPTY_MESSAGE: { status: 422, retryable: false, message: 'Please enter a message.' },
  MESSAGE_TOO_LONG: { status: 422, retryable: false, message: 'Your message is too long (max 2000 characters).' },
  RATING_REQUIRED: { status: 422, retryable: false, message: 'Please choose thumbs up or down.' },
  COMMENT_TOO_LONG: { status: 422, retryable: false, message: 'Your comment is too long (max 1000 characters).' },
  RATE_LIMITED: { status: 429, retryable: true, message: 'Too many requests. Please wait a moment and try again.' },
  PROMPT_INJECTION: { status: 400, retryable: false, message: "That request can't be processed. Please rephrase your question about the contract." },
  OPENAI_UNAVAILABLE: { status: 502, retryable: true, message: 'The AI service is busy. Try again in a few minutes.' },
  INTERNAL: { status: 500, retryable: true, message: 'Something went wrong. Please try again.' },
} as const

export type ErrorCode = keyof typeof ERROR_SPECS

/** Extra response metadata carried alongside an error (e.g. an accurate Retry-After). */
export interface AppErrorMeta {
  retryAfterSeconds?: number
}

/** An error carrying a canonical code, thrown inside route handlers and caught by `handleRoute`. */
export class AppError extends Error {
  code: ErrorCode
  detail?: string
  meta?: AppErrorMeta
  constructor(code: ErrorCode, detail?: string, meta?: AppErrorMeta) {
    super(detail ?? ERROR_SPECS[code].message)
    this.code = code
    this.detail = detail
    this.meta = meta
  }
}

/** Build a JSON error response with the standard envelope. */
export function errorResponse(code: ErrorCode, message?: string, meta?: AppErrorMeta): NextResponse<ApiError> {
  const spec = ERROR_SPECS[code]
  const body: ApiError = {
    error: { code, message: message ?? spec.message, retryable: spec.retryable },
  }
  const headers: Record<string, string> = {}
  if (code === 'RATE_LIMITED') {
    // Derived from the actual sliding window — a fixed 60 told callers on the
    // hourly /process limit to retry 59 minutes too early.
    headers['Retry-After'] = String(meta?.retryAfterSeconds ?? 60)
  }
  return NextResponse.json(body, { status: spec.status, headers })
}

/**
 * Wrap a route handler: converts thrown AppErrors into the standard envelope and
 * unknown errors into a safe 500. Keeps every route terse and consistent.
 */
export async function handleRoute<T>(fn: () => Promise<NextResponse<T>>): Promise<NextResponse> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.detail, err.meta)
    }
    // Log the message and stack only. Logging the whole error object can spill
    // request bodies and provider config into the log sink.
    console.error('[unhandled route error]', {
      message: err instanceof Error ? err.message : 'unknown error',
      stack: err instanceof Error ? err.stack : undefined,
    })
    return errorResponse('INTERNAL')
  }
}
