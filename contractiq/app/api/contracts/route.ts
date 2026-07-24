import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/security/authGuard'
import { handleRoute } from '@/lib/utils/errors'
import type { Contract } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ListItem = Pick<Contract, 'id' | 'name' | 'contract_type' | 'status' | 'created_at'>

/** GET /api/contracts — dashboard list + summary (FR-10). RLS-scoped. */
export async function GET() {
  return handleRoute(async () => {
    const { supabase } = await requireAuth()

    const { data } = await supabase
      .from('contracts')
      .select('id, name, contract_type, status, created_at')
      .order('created_at', { ascending: false })

    const contracts = (data ?? []) as ListItem[]
    const byType = {
      NDA: contracts.filter((c) => c.contract_type === 'NDA').length,
      MSA: contracts.filter((c) => c.contract_type === 'MSA').length,
    }

    return NextResponse.json({ total: contracts.length, by_type: byType, contracts })
  })
}
