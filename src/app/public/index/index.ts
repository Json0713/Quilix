import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Header } from '../common/header/header';
import { Footer } from '../common/footer/footer';

@Component({
  selector: 'app-public-index',
  imports: [RouterModule, Header, Footer],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class PublicIndex {

// Fallback for broken image links Testing 
onImageError(e: Event) {
  (e.target as HTMLImageElement).src = 'assets/img/offline-placeholder.png';
}

}
