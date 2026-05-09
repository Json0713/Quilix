import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class WindowManagerService {
  private baseZIndex = 2000;
  private windows = signal<string[]>([]);

  register(id: string) {
    this.windows.update(ids => ids.includes(id) ? ids : [...ids, id]);
    this.bringToFront(id);
  }

  unregister(id: string) {
    this.windows.update(ids => ids.filter(i => i !== id));
  }

  bringToFront(id: string) {
    this.windows.update(ids => [...ids.filter(i => i !== id), id]);
  }

  getZIndex(id: string): number {
    const index = this.windows().indexOf(id);
    return index === -1 ? this.baseZIndex : this.baseZIndex + index + 1;
  }

  isActive(id: string): boolean {
    const current = this.windows();
    return current.length > 0 && current[current.length - 1] === id;
  }
}
