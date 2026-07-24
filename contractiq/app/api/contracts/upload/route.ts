import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireAuth } from '@/lib/security/authGuard'
import { validateFileUpload } from '@/lib/security/inputValidator'
import { enforceRateLimit, userKey } from '@/lib/security/rateLimiter'
import { assertPageCount, assertContractTokens } from '@/lib/security/tokenLimiter'
import { AppError, handleRoute } from '@/lib/utils/errors'
import { createServiceClient } from '@/lib/supabase/service'
import { extractPdf } from '@/lib/pdf/extract'
import { estimateTokens, countWords } from '@/lib/pdf/tokens'
import { standardTermsFor } from '@/lib/prompts/term-libraries'
import { contractTypeSchema } from '@/lib/validation/schemas'
import { limits } from '@/lib/env'
import type { ContractType } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/contracts/upload — validate a PDF, extract text once (with [PAGE N]
 * markers), create the contract row, and best-effort upload the PDF to Storage.
 */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const { user } = await requireAuth()

    // Rate limit BEFORE reading the body: parsing a 10 MB PDF is CPU-bound work
    // that an authenticated user could otherwise trigger without any ceiling.
    await enforceRateLimit('upload', userKey(user.id))

    const form = await request.formData()
    const typeRaw = form.get('contract_type')

    const parsedType = contractTypeSchema.safeParse(typeRaw)
    if (!parsedType.success) throw new AppError('VALIDATION_ERROR', 'Choose a contract type (NDA or MSA).')
    const contractType: ContractType = parsedType.data

    // Extension blocklist → allowlist → declared MIME → size → magic-byte sniff.
    // Returns a sanitised filename that is safe to use in a Storage object key.
    const { buffer, filename, originalName } = await validateFileUpload(form.get('file'))
    const displayName = originalName.slice(0, 255)

    // Extract text once (single source of truth).
    let text: string
    let pageCount: number
    try {
      const extracted = await extractPdf(buffer)
      text = extracted.text
      pageCount = extracted.pageCount
    } catch {
      throw new AppError('PDF_PARSE_FAILED')
    }

    if (countWords(text) < limits.minExtractedWords) throw new AppError('SCANNED_PDF_UNSUPPORTED')
    assertPageCount(pageCount)

    const tokenCount = estimateTokens(text)
    assertContractTokens(tokenCount)

    const contractId = randomUUID()
    const service = createServiceClient()

    const { error: insertErr } = await service.from('contracts').insert({
      id: contractId,
      user_id: user.id,
      // Display label only — never used to build a path.
      name: displayName,
      contract_type: contractType,
      contract_text: text,
      page_count: pageCount,
      token_count: tokenCount,
      status: 'uploaded',
    })
    if (insertErr) {
      console.error('[upload] insert failed', { message: insertErr.message })
      throw new AppError('INTERNAL')
    }

    // Non-blocking Storage upload — failure only hides the PDF viewer.
    let fileAvailable = false
    try {
      // `filename` is sanitised. An unsanitised file.name containing "../" would
      // escape the per-user prefix that the Storage RLS policy keys on
      // ((storage.foldername(name))[1] = auth.uid()), letting an upload land in
      // — and later be signed out of — another user's folder.
      const path = `${user.id}/${contractId}/${filename}`
      const { error: storageErr } = await service.storage
        .from('contracts')
        .upload(path, buffer, { contentType: 'application/pdf', upsert: true })
      if (!storageErr) {
        fileAvailable = true
        await service.from('contracts').update({ file_path: path }).eq('id', contractId)
      } else {
        console.warn('[upload] storage upload failed (non-blocking)', storageErr.message)
      }
    } catch (err) {
      console.warn('[upload] storage upload threw (non-blocking)', err)
    }

    return NextResponse.json(
      {
        contract_id: contractId,
        name: displayName,
        contract_type: contractType,
        page_count: pageCount,
        status: 'uploaded',
        standard_terms: standardTermsFor(contractType),
        file_available: fileAvailable,
      },
      { status: 201 },
    )
  })
}
