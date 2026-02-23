import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Fail-safe initialization to prevent white screen crash
const isConfigured = supabaseUrl && supabaseAnonKey;

if (!isConfigured) {
  console.error('CRITICAL: Missing Supabase environment variables. App will run in limited mode.');
}

// If missing, use empty strings to allow app to mount (but requests will fail gracefully or show error UI)
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
)
