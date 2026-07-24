import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { publicEnv, serverEnv } from '@/lib/env'

/**
 * SERVER ONLY. Service-role client — bypasses RLS. Use for privileged writes
 * where user_id is set explicitly (e.g. inserting a contract after upload).
 * Never import this into a Client Component.
 */
export function createServiceClient() {
  return createSupabaseClient(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
