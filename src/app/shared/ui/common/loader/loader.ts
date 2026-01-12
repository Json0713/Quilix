import { Component } from '@angular/core';
import { inject } from '@angular/core';
import { LoaderService } from '../../../../services/ui/common/loader/loader';

@Component({
  selector: 'app-loader',
  imports: [],
  templateUrl: './loader.html',
  styleUrl: './loader.scss',
})
export class Loader {
  
  readonly loader = inject(LoaderService);

}
