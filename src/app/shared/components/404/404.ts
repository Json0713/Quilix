import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { BreadcrumbService } from '../../../services/ui/common/breadcrumb/breadcrumb.service';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './404.html',
  styleUrls: ['./404.scss']
})
export class PageNotFound implements OnInit {
  private router = inject(Router);
  private breadcrumb = inject(BreadcrumbService);

  ngOnInit() {
    this.breadcrumb.setTitle('404 - Page Not Found');
  }

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
