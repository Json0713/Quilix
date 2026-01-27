import { Inject, Injectable } from '@angular/core';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';

import { MetaAuthResult } from '../../interfaces/meta-auth-result';
import { MetaUserRole } from '../../interfaces/meta-role';

export interface MetaAuthMetadata {
  username: string;
  role: MetaUserRole;
  phone?: string | null;
}

@Injectable({ providedIn: 'root' })
export class MetaAuthService {

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient
  ) {}

  /** Register with EMAIL (phone optional as metadata) */
  async register(
    email: string,
    password: string,
    metadata: MetaAuthMetadata
  ): Promise<MetaAuthResult> {
    const { error } = await this.supabase.auth.signUp({
      email,
      password,
      options: { data: metadata }
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  /** Login with email OR phone (Supabase-native, safe) */
  async login(
    identifier: string,
    password: string
  ): Promise<MetaAuthResult> {
    const isEmail = identifier.includes('@');

    const credentials = isEmail
      ? { email: identifier, password }
      : { phone: identifier, password };

    const { error } =
      await this.supabase.auth.signInWithPassword(credentials);

    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  /** Auth user ONLY (no profile, no DB) */
  async getAuthUser(): Promise<User | null> {
    const { data } = await this.supabase.auth.getUser();
    return data.user ?? null;
  }

  async logout(): Promise<void> {
    await this.supabase.auth.signOut();
  }

}
