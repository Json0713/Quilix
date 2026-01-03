import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SpinnerService {
  private readonly _loading = signal<boolean>(false);

  readonly loading = this._loading.asReadonly();

  show(): void {
    this._loading.set(true);
  }

  hide(): void {
    this._loading.set(false);
  }

  toggle(): void {
    this._loading.update(v => !v);
  }

}
