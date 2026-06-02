import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BreadcrumbService } from '../../../../services/ui/common/breadcrumb/breadcrumb.service';

interface RecommendedApp {
  title: string;
  url: string;
  icon: string;
  category: 'Productivity' | 'Games' | 'Tools';
  description: string;
}

@Component({
  selector: 'app-quilix-app-store',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quilix-app-store.html',
  styleUrls: ['./quilix-app-store.scss']
})
export class QuilixAppStoreComponent implements OnInit {
  private router = inject(Router);
  private breadcrumb = inject(BreadcrumbService);

  readonly recommendedApps: RecommendedApp[] = [
    {
      title: 'Wikipedia',
      url: 'https://en.wikipedia.org/wiki/Main_Page',
      icon: 'bi-wikipedia',
      category: 'Productivity',
      description: 'The Free Encyclopedia'
    },
    {
      title: 'Desmos',
      url: 'https://www.desmos.com/scientific',
      icon: 'bi-calculator',
      category: 'Tools',
      description: 'Advanced Scientific Calculator'
    },
    {
      title: '2048',
      url: 'https://play2048.co/',
      icon: 'bi-grid-3x3',
      category: 'Games',
      description: 'Classic Number Puzzle'
    },
    {
      title: 'CodePen',
      url: 'https://codepen.io/pen/',
      icon: 'bi-code-slash',
      category: 'Tools',
      description: 'Online Code Editor'
    },
    {
      title: 'Hacker News',
      url: 'https://news.ycombinator.com/',
      icon: 'bi-h-square',
      category: 'Productivity',
      description: 'Tech & Startup News'
    },
    {
      title: 'Draw.io',
      url: 'https://app.diagrams.net/',
      icon: 'bi-diagram-3',
      category: 'Tools',
      description: 'Flowcharts & Diagrams'
    }
  ];

  ngOnInit() {
    this.breadcrumb.setTitle('App Store');
  }

  launchApp(url: string) {
    // Navigate via the Router so the address bar and tab state updates naturally
    const ctx = this.router.url.startsWith('/team') ? 'team' : 'personal';
    this.router.navigate([`/${ctx}/browse`], { queryParams: { url } });
  }
}
