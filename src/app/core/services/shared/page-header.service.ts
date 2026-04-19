import { Injectable, signal, TemplateRef } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PageHeaderService {
  /**
   * controls the visibility of the global page header
   */
  isVisible = signal<boolean>(true);

  /**
   * Controls whether the header should be sticky. 
   * Defaults to true for a premium feel.
   */
  isSticky = signal<boolean>(true);

  /**
   * Dynamic template for page-specific actions.
   * This is populated by the PageHeaderActionsDirective.
   */
  headerActions = signal<TemplateRef<any> | null>(null);

  /**
   * Title state, though BreadcrumbService usually handles this.
   * This can be used for secondary titles or overrides.
   */
  titleOverride = signal<string | null>(null);

  constructor() {}
}
