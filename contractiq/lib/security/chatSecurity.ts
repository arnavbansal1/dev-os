import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import { AppError } from '@/lib/utils/errors'
import type { Contract } from '@/types'

/**
 * Ownership checks for the chat surface (security-plan §6).
 *
 * Both helpers deliberately return NOT_FOUND rather than NOT_OWNER on failure:
 * a 403 would confirm that the id exists, letting an attacker enumerate valid
 * contract and session ids by probing.
 */

type ContractRow = Pick<Contract, 'id' | 'contract_text' | 'status' | 'user_id'>

/**
 * Load a contract only if the caller owns it.
 *
 * Reads through the request-scoped (RLS-enforcing) client AND re-asserts
 * `user_id` explicitly. The redundancy is intentional — RLS is the primary
 * control, but the explicit predicate means a future misconfigured policy
 * degrades to "no rows" instead of "every row".
 */
export async function verifyContractOwnership(
  supabase: SupabaseClient,
  contractId: string,
  userId: string,
): Promise<ContractRow> {
  const { data, error } = await supabase
    .from('contracts')
    .select('id, contract_text, status, user_id')
    .eq('id', contractId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) throw new AppError('NOT_FOUND')
  return data as ContractRow
}

/** Chat is only permitted once analysis has completed. */
export function requireCompletedContract(contract: Pick<Contract, 'status'>): void {
  if (contract.status !== 'complete') {
    throw new AppError('VALIDATION_ERROR', 'Finish processing to chat with this contract.')
  }
}

/**
 * Resolve the chat session for a contract the caller already owns, creating it
 * if absent.
 *
 * The session lookup runs on the service-role client (sessions are written
 * server-side), so it MUST be scoped by `user_id` as well as `contract_id` —
 * without that predicate the service client would happily return another user's
 * session row for a colliding contract id.
 */
export async function verifySessionOwnership(
  contractId: string,
  userId: string,
): Promise<string> {
  const service = createServiceClient()

  const { data: existing, error } = await service
    .from('chat_sessions')
    .select('id')
    .eq('contract_id', contractId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[security] chat session lookup failed', { message: error.message })
    throw new AppError('INTERNAL')
  }
  if (existing) return existing.id as string

  const { data: created, error: createErr } = await service
    .from('chat_sessions')
    .insert({ contract_id: contractId, user_id: userId })
    .select('id')
    .single()

  if (createErr || !created) throw new AppError('INTERNAL')
  return created.id as string
}
