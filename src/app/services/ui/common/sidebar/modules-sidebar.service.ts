import { Injectable, signal, effect } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ModulesSidebarService {
  private currentContext: 'team' | 'personal' = 'team';
  
  // Layout State
  isInitializing = signal(true);
  isOpen = signal(false);

  constructor() {
    // We don't initialize here because we need the context first
  }

  setContext(context: 'team' | 'personal') {
    this.currentContext = context;
    this.isOpen.set(this.getInitialState());
  }

  private get STORAGE_KEY(): string {
    return `quilix_${this.currentContext}_sidebar_state`;
  }

  private getInitialState(): boolean {
    if (typeof window !== 'undefined') {
      if (window.innerWidth <= 770) return false;
      const saved = localStorage.getItem(this.STORAGE_KEY);
      return saved === null ? true : saved === 'true';
    }
    return true;
  }

  toggle() {
    this.isOpen.update(val => {
      const newState = !val;
      if (typeof window !== 'undefined' && window.innerWidth > 770) {
        localStorage.setItem(this.STORAGE_KEY, String(newState));
      }
      return newState;
    });
  }

  close() {
    this.isOpen.set(false);
  }

  setInitializing(val: boolean) {
    this.isInitializing.set(val);
  }
}
