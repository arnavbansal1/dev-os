import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/security/authGuard'
import { requireUuid } from '@/lib/security/inputValidator'
import { enforceRateLimit, userKey } from '@/lib/security/rateLimiter'
import { sanitizeForLLM } from '@/lib/security/promptInjectionGuard'
import { assertMessageLength, chatHistoryLimit } from '@/lib/security/tokenLimiter'
import {
  verifyContractOwnership,
  requireCompletedContract,
  verifySessionOwnership,
} from '@/lib/security/chatSecurity'
import { AppError, handleRoute } from '@/lib/utils/errors'
import { createServiceClient } from '@/lib/supabase/service'
import { chatWithContract } from '@/lib/openai/chat.service'
import type { ChatMessage } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/contracts/[id]/chat — grounded Q&A with a conversation memory layer.
 * Loads the prior conversation BEFORE saving the new user message, classifies the
 * question (contract | history | both), retrieves the matching context, and
 * persists both turns with the answer's source for UI attribution.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  return handleRoute(async () => {
    const { user, supabase } = await requireAuth()
    const contractId = requireUuid(params.id)

    const body = await request.json().catch(() => ({}))
    const rawInput = typeof body?.message === 'string' ? body.message : ''
    const trimmed = assertMessageLength(rawInput)

    // Reject prompt-injection attempts before the model is ever called, so a
    // blocked attempt costs no tokens and cannot influence the system prompt.
    const raw = sanitizeForLLM(trimmed)
    if (!raw) throw new AppError('EMPTY_MESSAGE')

    // Ownership is asserted via RLS *and* an explicit user_id predicate.
    const contract = await verifyContractOwnership(supabase, contractId, user.id)
    requireCompletedContract(contract)

    await enforceRateLimit('chat', userKey(user.id))

    const service = createServiceClient()

    // Session lookup is scoped to this user, not just the contract.
    const sessionId = await verifySessionOwnership(contract.id, user.id)

    // CRITICAL: load the conversation history BEFORE persisting the new user
    // message. If we saved first, the classifier would always see the current
    // question as part of the history and misclassify every turn as a follow-up.
    // Ordered DESC + limit so the cap keeps the most RECENT turns; an ascending
    // limit would keep the oldest N and feed the model stale context once a
    // conversation passed the cap. Reversed back to chronological order after.
    const { data: history } = await service
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(chatHistoryLimit())

    const priorHistory = ((history ?? []) as ChatMessage[]).slice().reverse()

    // Now persist the user message (excluded from the history the classifier saw).
    await service.from('chat_messages').insert({
      session_id: sessionId,
      user_id: user.id,
      role: 'user',
      content: raw,
    })

    const answer = await chatWithContract(contract.contract_text, priorHistory, raw, user.id)

    const { data: assistantRow, error: insErr } = await service
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        user_id: user.id,
        role: 'assistant',
        content: answer.content,
        source: answer.source,
      })
      .select('id, role, content, source, created_at')
      .single()
    if (insErr || !assistantRow) throw new AppError('INTERNAL')

    return NextResponse.json({ message: assistantRow })
  })
}
