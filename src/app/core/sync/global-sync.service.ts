import { Injectable, Injector, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

@Injectable({
    providedIn: 'root'
})
export class GlobalSyncService {
    private channel = new BroadcastChannel('quilix_global_sync');
    private injector = inject(Injector);

    constructor() {
        this.initListener();
    }

    /**
     * Start listening to cross-tab messages and internal auth events.
     * This should be called once (usually by constructor, when awakened by App component).
     */
    init() {
        // No-op to allow injection to trigger constructor
        // or we can move logic here if constructor injection is problematic
    }

    private initListener() {
        // 1. Listen to cross-tab messages
        this.channel.onmessage = async (event) => {
            const { type } = event.data;
            const auth = this.injector.get(AuthService);

            if (type === 'LOGIN') {
                console.log('[SYNC] Login detected in another tab');
                // Could refresh state or notify user
            }

            if (type === 'LOGOUT') {
                console.log('[SYNC] Logout detected in another tab');
                // Pass true to indicate this is a sync-broadcast, 
                // so we don't broadcast it BACK out.
                await auth.logout(true);
            }
        };

        // 2. Listen to internal auth events (to broadcast to other tabs)
        // We delay this slighty to ensure AuthService is ready (injector helper)
        setTimeout(() => {
            const auth = this.injector.get(AuthService);
            auth.authEvents$.subscribe(event => {
                if (event === 'LOGIN') {
                    this.notifyLogin();
                } else if (event === 'LOGOUT') {
                    this.notifyLogout();
                }
            });
        }, 100);
    }

    private notifyLogin() {
        this.channel.postMessage({ type: 'LOGIN' });
    }

    private notifyLogout() {
        this.channel.postMessage({ type: 'LOGOUT' });
    }
}
