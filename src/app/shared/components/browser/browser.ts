import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { BreadcrumbService } from '../../../services/ui/common/breadcrumb/breadcrumb.service';
import { BrowserBookmarkService } from '../../../core/services/data/browser-bookmark.service';

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
  private bookmarkService = inject(BrowserBookmarkService);

  safeUrl: SafeResourceUrl | null = null;
  rawUrl = '';
  isBookmarked = false;

  ngOnInit() {
    this.breadcrumb.setTitle('Browser');

    this.route.queryParams.subscribe(async params => {
      const url = params['url'];
      if (url) {
        this.rawUrl = url;
        this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        this.isBookmarked = await this.bookmarkService.isBookmarked(url);
      } else {
        this.safeUrl = null;
        this.rawUrl = '';
        this.isBookmarked = false;
      }
    });
  }

  async toggleBookmark() {
    if (!this.rawUrl) return;

    if (this.isBookmarked) {
      await this.bookmarkService.removeBookmark(this.rawUrl);
      this.isBookmarked = false;
    } else {
      let hostname = 'Website';
      try {
        hostname = new URL(this.rawUrl).hostname;
      } catch (e) {}
      
      await this.bookmarkService.addBookmark({
        url: this.rawUrl,
        title: hostname,
        icon: 'bi-globe2',
        category: 'Tools',
        description: 'Saved from Browser'
      });
      this.isBookmarked = true;
    }
  }
}
