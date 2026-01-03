import { Component } from '@angular/core';
import { inject } from '@angular/core';
import { ToastService } from '../../../../services/ui/toast/toast';

@Component({
  selector: 'app-toast',
  imports: [],
  templateUrl: './toast.html',
  styleUrl: './toast.scss',
})
export class Toast {
  readonly toast = inject(ToastService);
}
