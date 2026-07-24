import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/utils/errors'

/**
 * Resolve the authenticated user for a Route Handler, or throw UNAUTHENTICATED.
 *
 * Always uses `auth.getUser()` (which revalidates the JWT against Supabase Auth)
 * rather than `auth.getSession()` (which trusts the cookie payload as-is and can
 * be spoofed). Returns the request-scoped, RLS-enforcing client alongside the
 * user so callers never accidentally reach for the service-role client.
 */
export async function requireAuth(): Promise<{
  user: User
  supabase: ReturnType<typeof createClient>
}> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new AppError('UNAUTHENTICATED')
  return { user, supabase }
}

export { safeRedirectPath } from '@/lib/security/redirect'
