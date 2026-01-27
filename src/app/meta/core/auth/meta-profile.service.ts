import { Inject, Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';
import { MetaUserProfile } from '../../interfaces/meta-user-profile';

@Injectable({ providedIn: 'root' })
export class MetaProfileService {

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient
  ) {}

  /** Get current user's profile */
  async getMyProfile(): Promise<MetaUserProfile | null> {
    const { data: auth } = await this.supabase.auth.getUser();
    if (!auth.user) return null;

    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', auth.user.id)
      .single();

    if (error) throw error;
    return data;
  }

  /** Update profile fields */
  async updateMyProfile(
    updates: Partial<MetaUserProfile>
  ): Promise<void> {
    const { data: auth } = await this.supabase.auth.getUser();
    if (!auth.user) throw new Error('Not authenticated');

    const { error } = await this.supabase
      .from('profiles')
      .update(updates)
      .eq('id', auth.user.id);

    if (error) throw error;
  }
}
