import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BreadcrumbService } from '../../../../services/ui/common/breadcrumb/breadcrumb.service';
import { TabService } from '../../../../core/services/ui/tab.service';

interface RecommendedApp {
  title: string;
  url: string;
  icon: string;
  category: 'Productivity' | 'Games' | 'Tools';
  description: string;
}

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

  searchQuery = '';

  readonly recommendedApps: RecommendedApp[] = [
    {
      title: 'Excalidraw',
      url: 'https://excalidraw.com/',
      icon: 'bi-pen',
      category: 'Tools',
      description: 'Virtual Whiteboard'
    },
    {
      title: 'tldraw',
      url: 'https://www.tldraw.com/',
      icon: 'bi-vector-pen',
      category: 'Productivity',
      description: 'Instant Diagramming'
    },
    {
      title: 'StackBlitz',
      url: 'https://stackblitz.com/',
      icon: 'bi-lightning',
      category: 'Tools',
      description: 'Web-based IDE'
    },
    {
      title: 'VS Code Web',
      url: 'https://vscode.dev/',
      icon: 'bi-code-slash',
      category: 'Productivity',
      description: 'Online Code Editor'
    },
    {
      title: '2048',
      url: 'https://play2048.co/',
      icon: 'bi-grid-3x3',
      category: 'Games',
      description: 'Classic Number Puzzle'
    },
    {
      title: 'Chrome Dino',
      url: 'https://dino-chrome.com/',
      icon: 'bi-controller',
      category: 'Games',
      description: 'T-Rex Runner Game'
    }
  ];

  ngOnInit() {
    this.breadcrumb.setTitle('Browser App');
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
}
