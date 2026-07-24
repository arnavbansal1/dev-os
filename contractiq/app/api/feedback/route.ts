import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/security/authGuard'
import { AppError, handleRoute } from '@/lib/utils/errors'
import { feedbackSchema } from '@/lib/validation/schemas'

export const runtime = 'nodejs'

/** POST /api/feedback — thumbs up/down + optional comment (US-010, FR-12). */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const { user, supabase } = await requireAuth()

    const body = await request.json().catch(() => ({}))
    const parsed = feedbackSchema.safeParse(body)
    if (!parsed.success) {
      const tooBig = parsed.error.issues.some((i) => i.path[0] === 'comment')
      throw new AppError(tooBig ? 'COMMENT_TOO_LONG' : 'RATING_REQUIRED')
    }

    // Ownership check (RLS-scoped read).
    const { data: contract, error } = await supabase
      .from('contracts')
      .select('id')
      .eq('id', parsed.data.contract_id)
      .eq('user_id', user.id)
      .maybeSingle()
    // NOT_FOUND rather than NOT_OWNER: a 403 would confirm the id exists.
    if (error || !contract) throw new AppError('NOT_FOUND')

    const { data, error: insErr } = await supabase
      .from('user_feedback')
      .insert({
        user_id: user.id,
        contract_id: parsed.data.contract_id,
        rating: parsed.data.rating,
        comment: parsed.data.comment ?? null,
      })
      .select('id')
      .single()
    if (insErr || !data) throw new AppError('INTERNAL')

    return NextResponse.json({ id: data.id }, { status: 201 })
  })
}
