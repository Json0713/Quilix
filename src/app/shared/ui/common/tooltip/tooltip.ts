import { Component, inject, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TooltipService, TooltipState } from '../../../../services/ui/common/tooltip/tooltip.service';

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
      [style.--shift-x.px]="state().shiftX"
    >
      <div class="tooltip-content" [style.transform]="'translateX(' + state().shiftX + 'px)'">
        {{ state().text }}
      </div>
      <!-- Tail stays aligned exactly to the element while the content shifts -->
      <div class="tooltip-tail"></div>
    </div>
  `
})
export class Tooltip {
  private tooltipService = inject(TooltipService);
  state: Signal<TooltipState> = this.tooltipService.tooltipState;
}
