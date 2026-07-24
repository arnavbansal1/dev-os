import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/security/authGuard'
import { requireUuid } from '@/lib/security/inputValidator'
import { AppError, handleRoute } from '@/lib/utils/errors'
import { keyTermUpdateSchema } from '@/lib/validation/schemas'
import type { KeyTerm } from '@/types'

export const runtime = 'nodejs'

/**
 * PATCH /api/key-terms/[id] — inline-edit a term value (US-009).
 * Sets is_edited=true; ai_original_value is preserved (never overwritten).
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  return handleRoute(async () => {
    const { user, supabase } = await requireAuth()
    const keyTermId = requireUuid(params.id)

    const body = await request.json().catch(() => ({}))
    const parsed = keyTermUpdateSchema.safeParse(body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR')

    // RLS + explicit user_id guard; returns the row only if the caller owns it.
    const { data, error } = await supabase
      .from('key_terms')
      .update({ value: parsed.data.value, is_edited: true })
      .eq('id', keyTermId)
      .eq('user_id', user.id)
      .select('*')
      .single()

    // NOT_FOUND rather than NOT_OWNER: a 403 would confirm the id exists.
    if (error || !data) throw new AppError('NOT_FOUND')

    return NextResponse.json({ key_term: data as KeyTerm })
  })
}
