import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { BreadcrumbService } from '../../../services/ui/common/breadcrumb/breadcrumb.service';

@Component({
  selector: 'app-browser',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './browser.html',
  styleUrls: ['./browser.scss']
})
export class BrowserComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private sanitizer = inject(DomSanitizer);
  private breadcrumb = inject(BreadcrumbService);

  safeUrl: SafeResourceUrl | null = null;
  rawUrl = '';

  ngOnInit() {
    this.breadcrumb.setTitle('Browser');

    this.route.queryParams.subscribe(params => {
      const url = params['url'];
      if (url) {
        this.rawUrl = url;
        this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
      } else {
        this.safeUrl = null;
        this.rawUrl = '';
      }
    });
  }
}
