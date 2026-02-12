import { InjectionToken } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { MetaConfigService } from '../config/meta-config.service';

export const SUPABASE_CLIENT = new InjectionToken<SupabaseClient>(
  'SUPABASE_CLIENT'
);

export function provideSupabaseClient(
  config: MetaConfigService
): SupabaseClient {
  return createClient(
    config.env.supabaseUrl,
    config.env.supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Using 'undefined' usually defaults to navigator locks.
        // If specific issues persist, safe to ignore in dev, 
        // or one can try `lock: { ... }` if supported by the version.
        // For now, let's enable detectSessionInUrl to true as it's standard 
        // to handle OAuth redirects properly which might be confusing the state.
      }
    }
  );
}
