import { createClient } from '@supabase/supabase-js'
import { env } from './env.js'

const baseOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
}

export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  baseOptions,
)

export const supabaseAuth = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY,
  baseOptions,
)
