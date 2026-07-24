import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/security/authGuard'
import { requireUuid } from '@/lib/security/inputValidator'
import { AppError, handleRoute } from '@/lib/utils/errors'
import { createServiceClient } from '@/lib/supabase/service'
import { limits } from '@/lib/env'
import type { Contract, KeyTerm } from '@/types'

export const runtime = 'nodejs'

/** GET /api/contracts/[id] — results-page payload (contract + terms + signed URL). */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  return handleRoute(async () => {
    const { user, supabase } = await requireAuth()
    const contractId = requireUuid(params.id)

    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (error || !data) throw new AppError('NOT_FOUND')
    const contract = data as Contract

    const { data: keyTerms } = await supabase
      .from('key_terms')
      .select('*')
      .eq('contract_id', contract.id)
      .order('created_at', { ascending: true })

    let signedUrl: string | null = null
    if (contract.file_path) {
      const service = createServiceClient()
      const { data: signed } = await service.storage
        .from('contracts')
        .createSignedUrl(contract.file_path, limits.signedUrlTtlSeconds)
      signedUrl = signed?.signedUrl ?? null
    }

    // Bump last_accessed_at (retention clock).
    await supabase
      .from('contracts')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', contract.id)

    return NextResponse.json({
      contract,
      key_terms: (keyTerms ?? []) as KeyTerm[],
      signed_url: signedUrl,
      page_count: contract.page_count,
    })
  })
}

/** DELETE /api/contracts/[id] — remove the contract, its Storage object, and (via cascade) all children. */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  return handleRoute(async () => {
    const { user, supabase } = await requireAuth()
    const contractId = requireUuid(params.id)

    const { data, error } = await supabase
      .from('contracts')
      .select('id, file_path')
      .eq('id', contractId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (error || !data) throw new AppError('NOT_FOUND')
    const contract = data as Pick<Contract, 'id' | 'file_path'>

    if (contract.file_path) {
      const service = createServiceClient()
      await service.storage.from('contracts').remove([contract.file_path])
    }

    const { error: delErr } = await supabase.from('contracts').delete().eq('id', contract.id)
    if (delErr) throw new AppError('INTERNAL')

    return new NextResponse(null, { status: 204 })
  })
}
