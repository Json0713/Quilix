import { Component, signal, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NetworkStatus } from './shared/ui/system/network-status/network-status';
import { NetworkService } from './core/quilix-installer/network/network.service';


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NetworkStatus],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {

  protected readonly title = signal('Quilix');
  readonly network = inject(NetworkService);

}
