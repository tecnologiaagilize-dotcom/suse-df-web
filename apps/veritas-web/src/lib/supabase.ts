import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = 'operator' | 'investor' | 'auditor' | 'regulator';

export interface User {
  id: string;
  wallet_address?: string;
  email?: string;
  name: string;
  role: UserRole;
  is_verified: boolean;
  created_at: string;
}
