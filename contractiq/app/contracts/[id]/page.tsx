import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { limits } from '@/lib/env'
import { AppHeader } from '@/components/ui/AppHeader'
import { ResultsView } from '@/components/results/ResultsView'
import type { Contract, KeyTerm } from '@/types'

export const metadata = { title: 'Contract results · ContractIQ' }

export default async function ContractResultsPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data } = await supabase.from('contracts').select('*').eq('id', params.id).single()

  if (!data) notFound()
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

  return (
    <div className="min-h-screen bg-surface">
      <AppHeader email={user?.email} />
      <main className="px-6 py-8 md:px-12">
        <div className="mx-auto max-w-[1200px]">
          <ResultsView
            initial={{
              contract,
              key_terms: (keyTerms ?? []) as KeyTerm[],
              signed_url: signedUrl,
              page_count: contract.page_count,
            }}
          />
        </div>
      </main>
    </div>
  )
}
