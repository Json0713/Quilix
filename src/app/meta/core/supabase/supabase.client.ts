import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { MetaConfigService } from '../config/meta-config.service';

let client: SupabaseClient | null = null;

export function getSupabaseClient(
  config: MetaConfigService
): SupabaseClient {
  if (!client) {
    client = createClient(
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

  return client;
}
