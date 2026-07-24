import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/security/authGuard'
import { requireUuid } from '@/lib/security/inputValidator'
import { enforceRateLimit, userKey } from '@/lib/security/rateLimiter'
import { AppError, handleRoute } from '@/lib/utils/errors'
import { createServiceClient } from '@/lib/supabase/service'
import { extractKeyTerms } from '@/lib/openai/extract.service'
import { standardTermsFor } from '@/lib/prompts/term-libraries'
import { processSchema } from '@/lib/validation/schemas'
import { limits } from '@/lib/env'
import type { ContractType, KeyTerm } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/contracts/[id]/process — run GPT-4o extraction over stored text
 * (standard + custom terms) and persist key_terms. Idempotent: re-processing
 * replaces prior terms.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  return handleRoute(async () => {
    const { user, supabase } = await requireAuth()
    const contractId = requireUuid(params.id)

    const body = await request.json().catch(() => ({}))
    const parsed = processSchema.safeParse(body)
    if (!parsed.success) {
      const tooMany = parsed.error.issues.some((i) => i.code === 'too_big')
      throw new AppError(tooMany ? 'TOO_MANY_CUSTOM_TERMS' : 'VALIDATION_ERROR')
    }
    const customTerms = parsed.data.custom_terms ?? []
    if (customTerms.length > limits.maxCustomTerms) throw new AppError('TOO_MANY_CUSTOM_TERMS')

    // RLS-scoped read plus an explicit user_id predicate → NOT_FOUND if not owner.
    const { data: contract, error } = await supabase
      .from('contracts')
      .select('id, contract_text, contract_type, status')
      .eq('id', contractId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (error || !contract) throw new AppError('NOT_FOUND')
    if (contract.status === 'processing') throw new AppError('ALREADY_PROCESSING')

    // Durable, Supabase-backed limit — enforced before the billable OpenAI call.
    await enforceRateLimit('process', userKey(user.id))

    const service = createServiceClient()
    await service.from('contracts').update({ status: 'processing' }).eq('id', contract.id)

    try {
      const contractType = contract.contract_type as ContractType
      const standard = standardTermsFor(contractType)
      const customSet = new Set(customTerms.map((t) => t.toLowerCase()))
      const allTerms = [...standard, ...customTerms]

      const extracted = await extractKeyTerms(contract.contract_text, contractType, allTerms, user.id)

      // Replace prior terms (idempotent re-process).
      await service.from('key_terms').delete().eq('contract_id', contract.id)

      const rows = extracted.map((t) => ({
        contract_id: contract.id,
        user_id: user.id,
        term_name: t.term_name,
        value: t.value,
        ai_original_value: t.value,
        page_number: t.page_number,
        confidence_score: t.confidence_score,
        source_sentence: t.source_sentence,
        is_edited: false,
        is_manual: customSet.has(t.term_name.toLowerCase()),
      }))

      const { data: inserted, error: insertErr } = await service
        .from('key_terms')
        .insert(rows)
        .select('*')
      if (insertErr) {
        console.error('[process] key_terms insert failed', insertErr)
        throw new AppError('INTERNAL')
      }

      await service
        .from('contracts')
        .update({ status: 'complete', last_accessed_at: new Date().toISOString() })
        .eq('id', contract.id)

      return NextResponse.json({
        contract_id: contract.id,
        status: 'complete',
        key_terms: (inserted ?? []) as KeyTerm[],
      })
    } catch (err) {
      // Mark error so the user can retry without re-uploading.
      await service.from('contracts').update({ status: 'error' }).eq('id', contract.id)
      throw err
    }
  })
}
