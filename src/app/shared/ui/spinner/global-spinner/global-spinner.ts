import { Component } from '@angular/core';
import { inject } from '@angular/core';
import { SpinnerService } from '../../../../services/ui/spinner/spinner';

@Component({
  selector: 'app-global-spinner',
  imports: [],
  templateUrl: './global-spinner.html',
  styleUrl: './global-spinner.scss',
})
export class GlobalSpinner {
  readonly spinner = inject(SpinnerService);

}
