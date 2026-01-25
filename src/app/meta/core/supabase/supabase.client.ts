import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { MetaConfigService } from '../config/meta-config.service';

export const SUPABASE_CLIENT = 'SUPABASE_CLIENT';

export function provideSupabaseClient(config: MetaConfigService): SupabaseClient {
  return createClient(
    config.env.supabaseUrl,
    config.env.supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    }
  );
  
}
