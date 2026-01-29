import { Inject, Injectable, signal, computed, effect } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';

import { SUPABASE_CLIENT } from '../supabase/supabase.client';
import { MetaUserProfile } from '../../interfaces/meta-user-profile';
import { MetaAuthService } from './meta-auth.service';
import { MetaUserRole } from '../../interfaces/meta-role';

@Injectable({ 
  providedIn: 'root' 
})
export class MetaProfileService {

  private readonly profileSignal = signal<MetaUserProfile | null>(null);
  private readonly loadingSignal = signal(false);
  private currentUserId: string | null = null;

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly auth: MetaAuthService
  ) {
    this.bindToAuth();
  }

  /* ----------------------------------
   * Public readonly state
   * ---------------------------------- */

  readonly profile = this.profileSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();

  readonly role = computed<MetaUserRole | null>(
    () => this.profileSignal()?.role ?? null
  );

  readonly hasProfile = computed(() => !!this.profileSignal());

  /* ----------------------------------
   * Guard-safe accessors
   * ---------------------------------- */

  async requireProfile(): Promise<MetaUserProfile | null> {
    if (this.profileSignal()) {
      return this.profileSignal();
    }

    if (!this.loadingSignal()) {
      await this.loadMyProfile();
    }

    return this.profileSignal();
  }

  hasRole(required: MetaUserRole): boolean {
    return this.profileSignal()?.role === required;
  }

  /* ----------------------------------
   * Profile loading
   * ---------------------------------- */

  async loadMyProfile(): Promise<void> {
    if (this.loadingSignal()) return;

    const user = await this.auth.requireUser();
    if (!user) {
      this.clear();
      return;
    }

    // Prevent reloading same user's profile
    if (this.currentUserId === user.id && this.profileSignal()) {
      return;
    }

    this.loadingSignal.set(true);
    this.currentUserId = user.id;

    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    this.loadingSignal.set(false);

    if (error) {
      this.clear();
      throw new Error('Failed to load profile');
    }

    this.profileSignal.set(data);
  }

  /* ----------------------------------
   * Update profile
   * ---------------------------------- */

  async updateMyProfile(
    updates: Partial<MetaUserProfile>
  ): Promise<void> {

    const user = await this.auth.requireUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { error } = await this.supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (error) {
      throw new Error('Failed to update profile');
    }

    this.profileSignal.update(current =>
      current ? { ...current, ...updates } : current
    );
  }

  /* ----------------------------------
   * Auth binding (CRITICAL)
   * ---------------------------------- */

  private bindToAuth(): void {
    effect(() => {
      const user = this.auth.user();

      if (!user) {
        this.clear();
        return;
      }

      // user switched
      if (user.id !== this.currentUserId) {
        this.clear();
        this.loadMyProfile();
      }
    });
  }

  /* ----------------------------------
   * Reset
   * ---------------------------------- */

  clear(): void {
    this.profileSignal.set(null);
    this.loadingSignal.set(false);
    this.currentUserId = null;
  }
}
