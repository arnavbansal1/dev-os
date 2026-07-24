import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/logout — clears the Supabase session server-side.
 *
 * POST-only by design: a GET logout is triggerable from any third-party page via
 * an <img> tag, which is a trivial denial-of-service against the user's session.
 * Supabase auth cookies are SameSite=Lax, so a cross-site POST cannot carry them.
 */
export async function POST() {
  const supabase = createClient()
  await supabase.auth.signOut()
  return new NextResponse(null, { status: 204 })
}
