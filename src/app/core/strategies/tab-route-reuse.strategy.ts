import { Injectable, inject } from '@angular/core';
import {
    RouteReuseStrategy,
    DetachedRouteHandle,
    ActivatedRouteSnapshot,
} from '@angular/router';
import { TabService } from '../services/ui/tab.service';

/**
 * TabRouteReuseStrategy — Chrome-style tab persistence for Angular.
 *
 * How it works:
 * - When the user navigates away from a page, Angular calls shouldDetach().
 *   We return true for all leaf page routes so their component instances are
 *   preserved in memory (detached from the DOM) instead of being destroyed.
 *
 * - When the user navigates back to a route, Angular calls shouldAttach().
 *   We return true ONLY when:
 *     (a) we have a cached instance for that route, AND
 *     (b) the navigation was triggered by a tab-bar click (lastNavigationWasTabSwitch = true).
 *   This means tab switching instantly restores the exact component state,
 *   while sidebar navigation on the same tab always creates a fresh component.
 *
 * Cache key: the full URL path including resolved route params (e.g. spaces/:id → spaces/abc123).
 * This ensures each unique page (including per-space pages) has its own cache slot.
 *
 * Cache limit: MAX_CACHE_SIZE entries (LRU-style: oldest evicted first).
 * This prevents unbounded memory growth in long-running sessions.
 */
@Injectable()
export class TabRouteReuseStrategy implements RouteReuseStrategy {

    private readonly tabService = inject(TabService);

    /** Cache of detached component instances, keyed by resolved route path. */
    private readonly cache = new Map<string, DetachedRouteHandle>();

    /**
     * Maximum number of page instances to keep in memory simultaneously.
     * Each entry holds the component tree for one page.
     * 20 is generous for a productivity app with ~10 distinct pages.
     */
    private readonly MAX_CACHE_SIZE = 20;

    // ── RouteReuseStrategy contract ──────────────────────────────────────────

    /**
     * Called when navigating AWAY from a route.
     * Return true to detach (cache) the component instead of destroying it.
     * We cache all leaf routes — those that actually render a page component.
     */
    shouldDetach(route: ActivatedRouteSnapshot): boolean {
        return this.isLeafRoute(route);
    }

    /**
     * Called after shouldDetach() returns true.
     * Store the detached component handle in the cache.
     * A null handle means Angular is explicitly clearing it — honour that.
     */
    store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
        const key = this.buildKey(route);
        if (!key) return;

        if (handle) {
            // Evict the oldest entry (first inserted) when cache is full
            if (this.cache.size >= this.MAX_CACHE_SIZE) {
                const oldestKey = this.cache.keys().next().value;
                if (oldestKey) this.cache.delete(oldestKey);
            }
            this.cache.set(key, handle);
        } else {
            this.cache.delete(key);
        }
    }

    /**
     * Called when navigating TO a route.
     * Return true to restore from cache (instant reattach, no ngOnInit).
     *
     * We only restore from cache when the navigation was a tab-bar click.
     * Sidebar navigation on the same tab bypasses the cache so the component
     * mounts fresh and ngOnInit can apply its reset logic (e.g. new chat).
     */
    shouldAttach(route: ActivatedRouteSnapshot): boolean {
        const key = this.buildKey(route);
        if (!key || !this.cache.has(key)) return false;

        // Only reuse the cached instance for explicit tab-bar switches.
        // The flag is set by TabService.activateTab(id, true) and reset by updateActiveTabRoute().
        return this.tabService.lastNavigationWasTabSwitch;
    }

    /**
     * Called after shouldAttach() returns true.
     * Return the stored handle so Angular can reattach the component.
     */
    retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
        const key = this.buildKey(route);
        return (key && this.cache.get(key)) ?? null;
    }

    /**
     * Called on every navigation to decide if the same component instance
     * can simply be updated (e.g. only query params changed).
     * Default behaviour: reuse the route if it maps to the same route config.
     */
    shouldReuseRoute(
        future: ActivatedRouteSnapshot,
        current: ActivatedRouteSnapshot,
    ): boolean {
        return future.routeConfig === current.routeConfig;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Builds a stable, unique string key for a route snapshot.
     * Uses the resolved URL segments (with actual param values, not placeholders)
     * so e.g. spaces/:spaceId resolves to spaces/abc123 — each space gets its own slot.
     * Returns an empty string for non-leaf (layout wrapper) routes.
     */
    private buildKey(route: ActivatedRouteSnapshot): string {
        if (!this.isLeafRoute(route)) return '';

        return route.pathFromRoot
            .flatMap(r => r.url)
            .map(segment => segment.toString())
            .filter(Boolean)
            .join('/');
    }

    /**
     * A leaf route is one that directly renders a page component.
     * Layout shells (template wrappers with children) are excluded because
     * caching them would break the router outlet nesting.
     */
    private isLeafRoute(route: ActivatedRouteSnapshot): boolean {
        // A route is a leaf if it has no children that are also matched routes
        return route.children.length === 0 &&
               (!!route.routeConfig?.component || !!route.routeConfig?.loadComponent);
    }

    // ── Public API for manual cache management ────────────────────────────────

    /**
     * Evict a specific route from the cache by its key.
     * Useful when a page's data has been deleted and the cached view is stale.
     * Example: call when a space is deleted to remove its cached component.
     */
    evict(routeKey: string): void {
        this.cache.delete(routeKey);
    }

    /** Clear the entire cache. Call when the user signs out or switches workspaces. */
    clearAll(): void {
        this.cache.clear();
    }
}
