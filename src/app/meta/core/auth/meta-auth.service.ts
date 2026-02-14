import { Inject, Injectable, OnDestroy, signal, computed } from '@angular/core';
import { SupabaseClient, Session, User } from '@supabase/supabase-js';

import { SUPABASE_CLIENT } from '../supabase/supabase.client';
import { MetaAuthResult } from '../../interfaces/meta-auth-result';
import { MetaUserRole } from '../../interfaces/meta-role';

export interface MetaAuthMetadata {
  username: string;
  role: MetaUserRole;
  phone?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class MetaAuthService implements OnDestroy {

  /* ----------------------------------
   * Internal state
   * ---------------------------------- */

  private readonly sessionSignal = signal<Session | null>(null);
  private readonly userSignal = signal<User | null>(null);
  private readonly initializedSignal = signal(false);

  private authSubscription?: { unsubscribe: () => void };
  private initResolver!: () => void;
  private readonly initPromise = new Promise<void>(res => {
    this.initResolver = res;
  });

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient
  ) {
    this.bootstrapAuth();
  }

  /* ----------------------------------
   * Public readonly state
   * ---------------------------------- */

  readonly session = this.sessionSignal.asReadonly();
  readonly user = this.userSignal.asReadonly();
  readonly initialized = this.initializedSignal.asReadonly();

  readonly isAuthenticated = computed(() => !!this.userSignal());

  /* ----------------------------------
   * Guards helper (SAFE)
   * ---------------------------------- */

  async requireUser(): Promise<User | null> {
    if (!this.initializedSignal()) {
      await this.initPromise;
    }
    return this.userSignal();
  }

  /* ----------------------------------
   * Auth actions
   * ---------------------------------- */

  async register(
    email: string,
    password: string,
    metadata: MetaAuthMetadata
  ): Promise<MetaAuthResult> {

    if (!email || !password || !metadata?.username || !metadata?.role) {
      return { success: false, error: 'Missing required fields' };
    }

    const { error } = await this.supabase.auth.signUp({
      email,
      password,
      options: { data: metadata }
    });

    if (error) {
      return { success: false, error: this.normalizeError(error.message) };
    }

    return { success: true };
  }

  async login(email: string, password: string): Promise<MetaAuthResult> {
    if (!email || !password) {
      return { success: false, error: 'Email and password are required' };
    }

    const { error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return { success: false, error: this.normalizeError(error.message) };
    }

    return { success: true };
  }

  async logout(): Promise<void> {
    await this.supabase.auth.signOut();

    // auth state change listener will finalize state
  }

  /* ----------------------------------
   * Bootstrap / lifecycle
   * ---------------------------------- */

  private async bootstrapAuth(): Promise<void> {
    const { data } = await this.supabase.auth.getSession();

    this.sessionSignal.set(data.session ?? null);
    this.userSignal.set(data.session?.user ?? null);

    this.listenToAuthChanges();

    this.initializedSignal.set(true);
    this.initResolver();
  }

  private listenToAuthChanges(): void {
    const { data } = this.supabase.auth.onAuthStateChange(
      (_event, session) => {
        this.sessionSignal.set(session);
        this.userSignal.set(session?.user ?? null);
      }
    );

    this.authSubscription = data.subscription;
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
  }

  /* ----------------------------------
   * Helpers
   * ---------------------------------- */

  private normalizeError(message: string): string {
    if (message.includes('Invalid login credentials')) {
      return 'Incorrect email or password';
    }
    if (message.includes('User already registered')) {
      return 'Email is already registered';
    }
    return 'Authentication failed. Please try again.';
  }
}
