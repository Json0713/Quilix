import { Injectable, signal, inject } from '@angular/core';
import { FileExplorerEntry } from '../../../../core/services/components/file-manager.service';
import { Router, NavigationStart } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class PreviewService {
    private router = inject(Router);
    
    private _visible = signal<boolean>(false);
    private _entry = signal<FileExplorerEntry | null>(null);

    readonly visible = this._visible.asReadonly();
    readonly entry = this._entry.asReadonly();

    constructor() {
        // Automatically close preview when navigating away from the current page
        // This avoids data leaks and ensures a clean state across different space views
        this.router.events.pipe(
            filter(event => event instanceof NavigationStart)
        ).subscribe(() => {
            if (this._visible()) {
                this.close();
            }
        });
    }

    open(entry: FileExplorerEntry) {
        this._entry.set(entry);
        this._visible.set(true);
    }

    close() {
        this._visible.set(false);
        this._entry.set(null); // Clear entry immediately to destroy heavy viewer components
    }

    // Allow [(visible)] binding from components
    setVisible(v: boolean) {
        this._visible.set(v);
        if (!v) {
            this._entry.set(null);
        }
    }
}
