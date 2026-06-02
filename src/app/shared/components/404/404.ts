import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './404.html',
  styleUrls: ['./404.scss']
})
export class PageNotFound {
  private router = inject(Router);

  goHome() {
    // If we're inside /team, go to /team. If /personal, go to /personal
    const currentUrl = this.router.url;
    if (currentUrl.startsWith('/team')) {
      this.router.navigate(['/team']);
    } else {
      this.router.navigate(['/personal']);
    }
  }
}
