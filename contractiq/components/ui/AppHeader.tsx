'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ShieldCheck, LogOut } from 'lucide-react'
import { Button } from './Button'

/** Top bar for authenticated pages. Client Component (needs sign-out action). */
export function AppHeader({ email }: { email?: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function signOut() {
    setLoading(true)
    // Sign out server-side so the httpOnly session cookies are actually cleared.
    // A browser-only signOut() leaves the server-set cookies in place, so the
    // session can survive on the server after the user believes they logged out.
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      router.replace('/')
      router.refresh()
    }
  }

  return (
    <header className="flex items-center justify-between border-b border-grey-100 bg-white px-6 py-4 md:px-12">
      <Link href="/dashboard" className="flex items-center gap-2">
        <ShieldCheck size={20} className="text-brand" />
        <span className="font-sans text-[16px] font-semibold text-grey-900">ContractIQ</span>
      </Link>
      <div className="flex items-center gap-4">
        {email && <span className="hidden font-sans text-[12px] text-grey-500 sm:inline">{email}</span>}
        <Button variant="ghost" size="sm" onClick={signOut} loading={loading}>
          <LogOut size={14} />
          Sign out
        </Button>
      </div>
    </header>
  )
}
