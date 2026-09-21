import type { SupabaseClient } from '@supabase/supabase-js'
export function getDb(): Promise<SupabaseClient>
