import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-spinner',
  imports: [],
  templateUrl: './spinner.html',
  styleUrl: './spinner.scss',
})
export class Spinner {

  @Input() size: number = 28;
  @Input() overlay: boolean = false;

}
