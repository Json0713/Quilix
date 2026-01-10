import { Component } from '@angular/core';
import { inject } from '@angular/core';
import { SpinnerService } from '../../../../services/ui/common/spinner/spinner';

@Component({
  selector: 'app-loader',
  imports: [],
  templateUrl: './loader.html',
  styleUrl: './loader.scss',
})
export class Loader {
  
    readonly spinner = inject(SpinnerService);

}
