// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export type DanceLevel = 'Haladó' | 'SzuperH' | 'ExtraH' | 'Hobbi';
export type UserRole = 'user' | 'teacher' | 'admin';

export interface Profile {
  id: string;
  name: string;
  email: string;
  gender: 'Fiú' | 'Lány';
  dance_level: DanceLevel;
  role: UserRole;
  can_view_detailed_stats: boolean;
  must_change_password: boolean;
  // ... egyéb mezők
}

export interface DanceEvent {
  id: string;
  event_date: string;
  location_id?: string;
  // ...
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // A böngészőben tartsuk meg és frissítsük a munkamenetet
    persistSession: true,
    autoRefreshToken: true,
    // A visszaállító / megerősítő linkek után az URL-ből épüljön fel a session.
    // Ez kell ahhoz, hogy a recovery (type=recovery) munkamenet létrejöjjön.
    detectSessionInUrl: true,
    // A verify?token=...&type=recovery linkekhez az implicit flow a helyes.
    flowType: 'implicit',
  },
})
