import { createClient } from '@supabase/supabase-js'
import { env } from '@/shared/lib/env'

export const supabaseBrowser = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY,
)
