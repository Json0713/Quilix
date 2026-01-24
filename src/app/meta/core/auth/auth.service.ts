import { Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';

import { MetaConfigService } from '../config/meta-config.service';
import { getSupabaseClient } from '../supabase/supabase.client';
import { MetaUserRole } from '../../interfaces/meta-role';
import { MetaAuthResult } from '../../interfaces/meta-auth-result';

@Injectable({ providedIn: 'root' })
export class MetaAuthService {
  private readonly supabase: SupabaseClient;

  constructor(config: MetaConfigService) {
    this.supabase = getSupabaseClient(config);
  }

  async register(
    email: string,
    password: string,
    role: MetaUserRole
  ): Promise<MetaAuthResult> {
    const { error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role }
      }
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  async login(
    email: string,
    password: string
  ): Promise<MetaAuthResult> {
    const { error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  async logout(): Promise<void> {
    await this.supabase.auth.signOut();
  }

  async restoreSession(): Promise<boolean> {
    const { data } = await this.supabase.auth.getSession();
    return !!data.session;
  }

  getCurrentUser() {
    return this.supabase.auth.getUser();
  }

}
