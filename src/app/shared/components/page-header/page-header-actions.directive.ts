import { Directive, inject, OnDestroy, OnInit, TemplateRef } from '@angular/core';
import { PageHeaderService } from '../../../core/services/shared/page-header.service';

@Directive({
  selector: 'ng-template[appPageHeaderActions]',
  standalone: true
})
export class PageHeaderActionsDirective implements OnInit, OnDestroy {
  private headerService = inject(PageHeaderService);
  private templateRef = inject(TemplateRef);

  ngOnInit(): void {
    // Register this template as the active header actions
    this.headerService.headerActions.set(this.templateRef);
  }

  ngOnDestroy(): void {
    // Clear the actions when this page/component is destroyed
    // But only if this specifically was the current template (to avoid race conditions)
    if (this.headerService.headerActions() === this.templateRef) {
      this.headerService.headerActions.set(null);
    }
  }
}
