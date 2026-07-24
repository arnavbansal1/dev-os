'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/browser'
import { publicEnv } from '@/lib/env'
import { safeRedirectPath } from '@/lib/security/redirect'
import { Button } from './Button'
import { Input, Label, FieldError } from './Input'

type Mode = 'login' | 'signup'

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter()
  const params = useSearchParams()
  // `?redirect=` is attacker-controllable — anything not a same-origin path is
  // discarded, otherwise /login?redirect=https://evil.example turns this form
  // into a phishing hop that carries our domain's credibility.
  const redirectTo = safeRedirectPath(params.get('redirect'))

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setLoading(true)
    const supabase = createClient()

    try {
      if (mode === 'signup') {
        if (password.length < 6) {
          setError('Password must be at least 6 characters.')
          return
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${publicEnv.siteUrl}/dashboard` },
        })
        if (error) {
          setError(mapAuthError(error.message))
          return
        }
        if (data.session) {
          router.replace(redirectTo)
          router.refresh()
        } else {
          setNotice('Check your email to verify your account, then sign in.')
        }
      } else {
        // Sign in through our own route so the attempt passes through the
        // server-side rate limiter; a direct browser call to Supabase is
        // invisible to the app and cannot be throttled against credential
        // stuffing.
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
        if (!res.ok) {
          const payload = await res.json().catch(() => null)
          setError(payload?.error?.message ?? 'Invalid email or password.')
          return
        }
        router.replace(redirectTo)
        router.refresh()
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>

      {error && <FieldError>{error}</FieldError>}
      {notice && <p className="font-sans text-[12px] leading-[18px] text-green-700">{notice}</p>}

      <Button type="submit" loading={loading} className="mt-2">
        {mode === 'signup' ? 'Get Started Free' : 'Sign In'}
      </Button>

      <p className="font-sans text-[12px] leading-[18px] text-grey-500">
        {mode === 'signup' ? (
          <>
            Already have an account?{' '}
            <Link href="/login" className="text-brand">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New to ContractIQ?{' '}
            <Link href="/signup" className="text-brand">
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  )
}

function mapAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login')) return 'Invalid email or password.'
  if (m.includes('already registered') || m.includes('already exists'))
    return 'An account with this email already exists. Sign in instead.'
  if (m.includes('email not confirmed')) return 'Please verify your email first — check your inbox.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Please wait a moment and try again.'
  // Never surface raw provider errors: they leak backend detail and wording that
  // distinguishes "no such user" from "wrong password" enables account enumeration.
  return 'Something went wrong. Please try again.'
}
