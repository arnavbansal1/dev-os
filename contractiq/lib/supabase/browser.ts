import { createBrowserClient } from '@supabase/ssr'
import { publicEnv } from '@/lib/env'

/**
 * Supabase client for Client Components (auth actions, RLS-scoped reads, Realtime).
 * Safe to use in the browser — only the anon key is exposed.
 */
export function createClient() {
  return createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey)
}
