import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AppHeader } from '@/components/ui/AppHeader'
import { SummaryCard } from '@/components/dashboard/SummaryCard'
import { ContractTable, type ContractListItem } from '@/components/dashboard/ContractTable'
import { EmptyState } from '@/components/dashboard/EmptyState'

export const metadata = { title: 'Dashboard · ContractIQ' }

export default async function DashboardPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: contracts } = await supabase
    .from('contracts')
    .select('id, name, contract_type, status, created_at')
    .order('created_at', { ascending: false })

  const list = (contracts ?? []) as ContractListItem[]
  const byType = {
    NDA: list.filter((c) => c.contract_type === 'NDA').length,
    MSA: list.filter((c) => c.contract_type === 'MSA').length,
  }

  return (
    <div className="min-h-screen bg-surface">
      <AppHeader email={user?.email} />
      <main className="px-6 py-12 md:px-12">
        <div className="mx-auto flex max-w-[960px] flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-sans text-[24px] font-medium leading-8 text-grey-900">Your contracts</h1>
            <Link href="/review" className="btn-primary">
              Review a Contract
            </Link>
          </div>

          {list.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <SummaryCard total={list.length} byType={byType} />
              <ContractTable initialContracts={list} />
            </>
          )}
        </div>
      </main>
    </div>
  )
}
