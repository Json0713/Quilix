import { Component, inject, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TooltipManagerService, TooltipState } from '../../../../core/services/tooltip-manager.service';

@Component({
  selector: 'app-tooltip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div 
      class="tooltip-container" 
      [class.visible]="state().visible"
      [class.pos-top]="state().position === 'top'"
      [class.pos-bottom]="state().position === 'bottom'"
      [style.left.px]="state().x"
      [style.top.px]="state().y"
    >
      <div class="tooltip-content">
        {{ state().text }}
      </div>
      <div class="tooltip-tail"></div>
    </div>
  `
})
export class Tooltip {
  private tooltipManager = inject(TooltipManagerService);
  state: Signal<TooltipState> = this.tooltipManager.tooltipState;
}
