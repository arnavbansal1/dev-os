import { createClient } from '@/lib/supabase/server'
import { AppHeader } from '@/components/ui/AppHeader'
import { ReviewFlow } from '@/components/upload/ReviewFlow'

export const metadata = { title: 'Review a contract · ContractIQ' }

export default async function ReviewPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-surface">
      <AppHeader email={user?.email} />
      <main className="px-6 py-12 md:px-12">
        <ReviewFlow />
      </main>
    </div>
  )
}
