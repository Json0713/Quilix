import { Injectable, signal } from '@angular/core';
import { FileExplorerEntry } from '../../../../core/services/components/file-manager.service';

@Injectable({
    providedIn: 'root'
})
export class PreviewService {
    private _visible = signal<boolean>(false);
    private _entry = signal<FileExplorerEntry | null>(null);

    readonly visible = this._visible.asReadonly();
    readonly entry = this._entry.asReadonly();

    open(entry: FileExplorerEntry) {
        this._entry.set(entry);
        this._visible.set(true);
    }

    close() {
        this._visible.set(false);
        // We keep the entry so the window has content while closing
    }

    // Allow [(visible)] binding
    setVisible(v: boolean) {
        this._visible.set(v);
    }
}
