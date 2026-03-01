import { Injectable, signal } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class BreadcrumbService {
    /**
     * Globally reactive page title used by the `<app-breadcrumb>` component.
     * Any routed page can inject this service and call `setTitle('...')` on mount.
     */
    readonly title = signal<string>('Home');

    setTitle(newTitle: string): void {
        this.title.set(newTitle);
    }
}
