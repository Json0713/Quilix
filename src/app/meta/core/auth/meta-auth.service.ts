import { Inject, Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';
import { MetaUserRole } from '../../interfaces/meta-role';
import { MetaAuthResult } from '../../interfaces/meta-auth-result';
import { MetaUserProfile } from '../../interfaces/meta-user-profile';

@Injectable({ providedIn: 'root' })
export class MetaAuthService {

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient
  ) {}

  /**
   * Safe register: bypass Supabase email sending
   * @param username Required username (unique)
   * @param password Required password
   * @param role User role
   * @param email Optional email (for profile only)
   * @param phone Optional phone (for profile only)
   */
  async register(
    username: string,
    password: string,
    role: MetaUserRole,
    email?: string,
    phone?: string
  ): Promise<MetaAuthResult> {
    try {
      const response = await fetch('/api/meta-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          role,
          email,
          phone
        })
      });

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error };
      }

      return { success: true };
    } catch {
      return { success: false, error: 'Registration service unavailable' };
    }
  }

  /**
   * Login using username + password (internal email)
   */
  async login(username: string, password: string): Promise<MetaAuthResult> {
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
    try {
      const { data } = await this.supabase.auth.getSession();
      if (data.session) return true;
    } catch (err) {
      console.warn('Supabase session restore failed, falling back to localStorage');
    }

    const stored = localStorage.getItem('meta-session');
    if (stored) {
      const session = JSON.parse(stored);
      await this.supabase.auth.setSession(session);
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
