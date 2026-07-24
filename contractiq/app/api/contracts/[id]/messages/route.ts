import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/security/authGuard'
import { requireUuid } from '@/lib/security/inputValidator'
import { chatHistoryLimit } from '@/lib/security/tokenLimiter'
import { AppError, handleRoute } from '@/lib/utils/errors'

export const runtime = 'nodejs'

/** GET /api/contracts/[id]/messages — hydrate persisted chat history (US-012). */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  return handleRoute(async () => {
    const { user, supabase } = await requireAuth()
    const contractId = requireUuid(params.id)

    const { data: contract, error } = await supabase
      .from('contracts')
      .select('id')
      .eq('id', contractId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (error || !contract) throw new AppError('NOT_FOUND')

    const { data: session } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('contract_id', contract.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!session) return NextResponse.json({ session_id: null, messages: [] })

    const { data: messages } = await supabase
      .from('chat_messages')
      .select('id, role, content, source, created_at')
      .eq('session_id', session.id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(chatHistoryLimit())

    return NextResponse.json({ session_id: session.id, messages: messages ?? [] })
  })
}
