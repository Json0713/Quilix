import { Injectable, inject, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { TabService } from './tab.service';

@Injectable({ providedIn: 'root' })
export class ShortcutService {
  private router = inject(Router);
  private tabService = inject(TabService);
  private zone = inject(NgZone);

  /**
   * Initializes the global shortcut listeners.
   * Call this once at the application root level (AppComponent).
   */
  init(): void {
    window.addEventListener('keydown', (event: KeyboardEvent) => {
      this.handleKeyDown(event);
    });
  }

  /**
   * Safe entry point for keyboard events.
   * Intercepts specific hotkeys to provide high-performance desktop native behaviors.
   */
  private async handleKeyDown(event: KeyboardEvent) {
    const isQ = event.key.toLowerCase() === 'q';
    const isCtrl = event.ctrlKey || event.metaKey;
    const isShift = event.shiftKey;

    // ── Ctrl + Q: New Tab ──
    if (isCtrl && isQ && !isShift) {
      event.preventDefault();
      // Ensure we run inside Angular's zone to trigger navigation and change detection
      this.zone.run(async () => {
        await this.handleNewTab();
      });
    }

    // ── Ctrl + Shift + Q: New Window ──
    else if (isCtrl && isQ && isShift) {
      event.preventDefault();
      this.handleNewWindow();
    }
  }

  /**
   * Creates a new Home tab within the current workspace context.
   */
  private async handleNewTab() {
    const url = this.router.url;
    let prefix = '';

    // Extract layout context (e.g., /personal or /team)
    if (url.includes('/personal')) {
      prefix = 'personal';
    } else if (url.includes('/team')) {
      prefix = 'team';
    }

    // If we're not inside a workspace-bound route (like /meta or /login), 
    // creating a tab doesn't make logical sense in the current architecture.
    if (!prefix) return;

    try {
      const tab = await this.tabService.createTab();

      // Navigate to the root of the current layout (which is 'Home' for the new tab)
      // We use absolute paths to ensure deterministic navigation from anywhere in the tree.
      await this.router.navigate([`/${prefix}`]);
    } catch (err) {
      console.warn('[ShortcutService] Failed to create new tab:', err);
    }
  }

  /**
   * Spawns a physical OS window pointing to the fresh root origin.
   * This mimics browser/native behavior without interrupting the current session.
   */
  private handleNewWindow() {
    const width = screen.availWidth;
    const height = screen.availHeight;

    // We pass 'popup' to force a clean, chrome-less desktop feel if configured as PWA.
    // We append ?fresh=true to ensure TabService forces a new windowSessionId,
    // bypassing the native sessionStorage inheritance from the parent window.
    window.open(
      `${window.location.origin}?fresh=true`,
      '_blank',
      `popup,width=${width},height=${height},top=0,left=0`
    );
  }
}
