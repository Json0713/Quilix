import { Inject, Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';
import { MetaUserRole } from '../../interfaces/meta-role';
import { MetaAuthResult } from '../../interfaces/meta-auth-result';
import { MetaUserProfile } from '../../interfaces/meta-user-profile';

@Injectable({ providedIn: 'root' 
})
export class MetaAuthService {

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient
  ) {}

  /**
   * Register a new user
   * @param username Required username (unique)
   * @param password Required password
   * @param role User role
   * @param email Optional email
   * @param phone Optional phone number
   */
  async register(
    username: string,
    password: string,
    role: MetaUserRole,
    email?: string,
    phone?: string
  ): Promise<MetaAuthResult> {
    // Supabase Auth requires an email
    const internalEmail = email || `${username}@internal.local`;

    const { data, error } = await this.supabase.auth.signUp({
      email: internalEmail,
      password,
      options: {
        data: {
          username,
          role,
          email: email ?? null,
          phone: phone ?? null
        }
      }
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  /**
   * Login using username + password
   * Internally maps username -> internal email
   */
  async login(
    username: string,
    password: string
  ): Promise<MetaAuthResult> {
    const internalEmail = `${username}@internal.local`;

    const { error } = await this.supabase.auth.signInWithPassword({
      email: internalEmail,
      password
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    await this.supabase.auth.signOut();
  }

  /**
   * Restore session if exists
   */
  async restoreSession(): Promise<boolean> {
    // Try Supabase first
    try {
      const { data } = await this.supabase.auth.getSession();
      if (data.session) return true;
    } catch (err) {
      console.warn('Supabase session restore failed, falling back to localStorage');
    }

    // Fallback to manual restore
    const stored = localStorage.getItem('meta-session');
    if (stored) {
      const session = JSON.parse(stored);
      await this.supabase.auth.setSession(session); // temporary restore
      return true;
    }

    return false;
  }

  /**
   * Get current logged-in user profile
   */
  async getCurrentUser(): Promise<MetaUserProfile | null> {
    const { data } = await this.supabase.auth.getUser();
    if (!data.user) return null;

    // Return MetaUserProfile mapped from Supabase user_metadata
    const meta: any = data.user.user_metadata;
    return {
      id: data.user.id,
      username: meta.username,
      role: meta.role,
      email: meta.email,
      phone: meta.phone,
      createdAt: data.user.created_at
    };
  }

  /**
   * Delete current user account
   */
  async deleteCurrentUser(): Promise<MetaAuthResult> {
    const { data: userData } = await this.supabase.auth.getUser();
    if (!userData.user) return { success: false, error: 'No user logged in' };

    const { error } = await this.supabase.auth.admin.deleteUser(userData.user.id);

    if (error) return { success: false, error: error.message };
    return { success: true };
  }

}
