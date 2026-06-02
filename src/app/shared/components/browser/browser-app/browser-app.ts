import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BreadcrumbService } from '../../../../services/ui/common/breadcrumb/breadcrumb.service';
import { TabService } from '../../../../core/services/ui/tab.service';
import { BrowserBookmarkService } from '../../../../core/services/data/browser-bookmark.service';
import { BrowserBookmark } from '../../../../core/database/dexie.models';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-browser-app',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './browser-app.html',
  styleUrls: ['./browser-app.scss']
})
export class BrowserAppComponent implements OnInit {
  private router = inject(Router);
  private breadcrumb = inject(BreadcrumbService);
  private tabService = inject(TabService);
  private bookmarkService = inject(BrowserBookmarkService);

  searchQuery = '';
  bookmarks$: Observable<BrowserBookmark[]> | undefined;

  ngOnInit() {
    this.breadcrumb.setTitle('Browser App');
    this.bookmarks$ = this.bookmarkService.getBookmarks$();
  }

  onSearchInput(event: Event) {
    this.searchQuery = (event.target as HTMLInputElement).value;
  }

  onSearchSubmit(event: Event) {
    event.preventDefault();
    if (this.searchQuery.trim()) {
      let url = this.searchQuery.trim();
      // Auto-prefix with https:// if no protocol is provided
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        // Simple heuristic: if it contains a dot and no spaces, treat as domain
        if (url.includes('.') && !url.includes(' ')) {
          url = `https://${url}`;
        } else {
          // It's a keyword search, route to safe Bing search iframe
          url = `https://www.bing.com/search?q=${encodeURIComponent(url)}`;
        }
      }
      this.launchApp(url);
    }
  }

  launchApp(url: string) {
    // Navigate via the Router so the address bar and tab state updates naturally
    const ctx = this.router.url.startsWith('/team') ? 'team' : 'personal';
    this.router.navigate([`/${ctx}/browse`], { queryParams: { url } }).then(success => {
      if (success) {
        let hostname = 'Browser';
        try {
          hostname = new URL(url).hostname;
        } catch (e) {}
        this.tabService.updateActiveTabRoute(`./browse?url=${encodeURIComponent(url)}`, hostname, 'bi-globe2');
      }
    });
  }

  async removeBookmark(url: string, event: Event) {
    event.stopPropagation(); // prevent launchApp from triggering
    await this.bookmarkService.removeBookmark(url);
  }
}
