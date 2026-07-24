import { z } from 'zod'
import { AppError } from '@/lib/utils/errors'
import { limits } from '@/lib/env'

/**
 * Upload + request validation (security-plan §7).
 *
 * ContractIQ is PDF-only: the Storage bucket is created with
 * `allowed_mime_types = ['application/pdf']` and the extractor is pdf-parse, so
 * the allow-list here is deliberately narrower than the generic
 * `.pdf`/`.docx` baseline. Widening it means widening the bucket too.
 */
const ALLOWED_EXTENSIONS = ['.pdf'] as const
const ALLOWED_MIME_TYPES = ['application/pdf'] as const

/**
 * Explicitly-denied extensions, checked before the allow-list so that a
 * double-extension payload ("invoice.pdf.exe") is rejected on its *effective*
 * extension rather than sneaking past a naive `endsWith('.pdf')`.
 */
const BLOCKED_EXTENSIONS = [
  '.exe', '.js', '.mjs', '.cjs', '.php', '.zip', '.sh', '.bat', '.cmd',
  '.py', '.rb', '.ps1', '.jar', '.dll', '.so', '.app', '.msi', '.com',
  '.scr', '.vbs', '.html', '.htm', '.svg',
] as const

/** `%PDF-` — the signature every conforming PDF opens with. */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot === -1 ? '' : filename.slice(dot).toLowerCase()
}

/**
 * Reduce an untrusted upload filename to a safe, storable basename.
 *
 * `file.name` is fully attacker-controlled and was previously interpolated
 * straight into the Storage object key. A name like `../../<other-uid>/x.pdf`
 * escapes the per-user prefix that the Storage RLS policy relies on
 * (`(storage.foldername(name))[1] = auth.uid()`), and newlines in the key can
 * corrupt downstream requests.
 *
 * Strips directory separators, control characters, and leading dots; collapses
 * everything outside a conservative charset; and bounds the length.
 */
export function safeFilename(raw: string, fallback = 'contract.pdf'): string {
  // Take the basename only — defeats both / and \ traversal.
  const base = raw.split(/[/\\]/).pop() ?? ''

  let cleaned = ''
  for (const ch of base) {
    const c = ch.codePointAt(0) as number
    if (c <= 0x1f || (c >= 0x7f && c <= 0x9f)) continue
    cleaned += /[A-Za-z0-9._-]/.test(ch) ? ch : '_'
  }

  // No leading dots ("..", ".env"), no empty result.
  cleaned = cleaned.replace(/^\.+/, '')
  if (!cleaned) return fallback

  // Bound the length while preserving the extension.
  const ext = extensionOf(cleaned)
  const stem = ext ? cleaned.slice(0, -ext.length) : cleaned
  return `${stem.slice(0, 100) || 'contract'}${ext}`
}

export interface ValidatedUpload {
  /** The raw bytes, already read from the request. */
  buffer: Buffer
  /** Sanitised name, safe to use in a Storage object key. */
  filename: string
  /** Original (unsanitised) name — safe to persist as a display label only. */
  originalName: string
  size: number
}

/**
 * Validate an uploaded file in defence-in-depth order:
 *   1. extension blocklist  (reject known-dangerous first)
 *   2. extension allowlist
 *   3. declared MIME type
 *   4. size
 *   5. content sniffing — the declared type is client-supplied and trivially
 *      forged, so the bytes must actually begin with a PDF signature.
 *
 * Throws the canonical AppError for each failure mode.
 */
export async function validateFileUpload(file: unknown): Promise<ValidatedUpload> {
  if (!(file instanceof File)) {
    throw new AppError('VALIDATION_ERROR', 'No file was uploaded.')
  }

  const originalName = file.name ?? ''
  const ext = extensionOf(originalName)

  // 1. Blocklist.
  if ((BLOCKED_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new AppError('UNSUPPORTED_TYPE')
  }

  // 2. Allowlist.
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new AppError('UNSUPPORTED_TYPE')
  }

  // 3. Declared MIME type.
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    throw new AppError('UNSUPPORTED_TYPE')
  }

  // 4. Size — checked before reading the body into memory where possible.
  if (file.size > limits.maxUploadBytes) throw new AppError('FILE_TOO_LARGE')
  if (file.size === 0) throw new AppError('VALIDATION_ERROR', 'The uploaded file is empty.')

  const buffer = Buffer.from(await file.arrayBuffer())

  // Re-check post-read: `file.size` is a client-reported value on some runtimes.
  if (buffer.byteLength > limits.maxUploadBytes) throw new AppError('FILE_TOO_LARGE')

  // 5. Magic-byte sniff. Conforming PDFs open with "%PDF-"; the spec tolerates
  //    leading junk, so scan a small prefix rather than only offset 0.
  if (!hasPdfSignature(buffer)) throw new AppError('UNSUPPORTED_TYPE')

  return {
    buffer,
    filename: safeFilename(originalName),
    originalName,
    size: buffer.byteLength,
  }
}

function hasPdfSignature(buffer: Buffer): boolean {
  const window = buffer.subarray(0, Math.min(buffer.length, 1024))
  const idx = window.indexOf(Buffer.from(PDF_MAGIC))
  return idx !== -1
}

/** Route params carrying a resource id must be well-formed UUIDs. */
export const uuidSchema = z.string().uuid()

/**
 * Validate a `[id]` route segment. Without this, a non-UUID segment reaches
 * Postgres and raises a 22P02 type error, which surfaces as a generic 500
 * instead of a clean rejection.
 */
export function requireUuid(value: string): string {
  const parsed = uuidSchema.safeParse(value)
  if (!parsed.success) throw new AppError('NOT_FOUND')
  return parsed.data
}

// Re-export the request schemas so routes have a single security entry point.
export {
  contractTypeSchema,
  uploadSchema,
  customTermsSchema,
  processSchema,
  keyTermUpdateSchema,
  chatMessageSchema,
  feedbackSchema,
} from '@/lib/validation/schemas'
