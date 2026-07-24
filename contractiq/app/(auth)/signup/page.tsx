import { Suspense } from 'react'
import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { AuthForm } from '@/components/ui/AuthForm'
import { Card } from '@/components/ui/Card'

export const metadata = { title: 'Get Started · ContractIQ' }

export default function SignupPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-24">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <ShieldCheck size={22} className="text-brand" />
        <span className="font-sans text-[18px] font-semibold text-grey-900">ContractIQ</span>
      </Link>
      <Card className="w-full max-w-[400px] p-8">
        <h1 className="mb-1 font-sans text-[24px] font-medium leading-8 text-grey-900">Get started free</h1>
        <p className="mb-6 font-sans text-[12px] leading-[18px] text-grey-500">
          Review your first NDA or MSA in minutes.
        </p>
        <Suspense fallback={null}>
          <AuthForm mode="signup" />
        </Suspense>
      </Card>
    </main>
  )
}
