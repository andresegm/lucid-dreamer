import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const configError: string | null = !url
  ? 'VITE_SUPABASE_URL is missing.'
  : !anonKey
    ? 'VITE_SUPABASE_ANON_KEY is missing.'
    : null

export const supabase: SupabaseClient = createClient(
  url ?? 'https://placeholder.supabase.co',
  anonKey ?? 'placeholder',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } },
)
