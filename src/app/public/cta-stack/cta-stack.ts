import { Component, ChangeDetectionStrategy, AfterViewInit } from '@angular/core';

interface StackGroup {
  title: string;
  badges: {
    label: string;
    src: string;
  }[];
}

@Component({
  selector: 'app-cta-stack',  
  imports: [],
  templateUrl: './cta-stack.html',
  styleUrl: './cta-stack.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CtaStack implements AfterViewInit {
  readonly groups: StackGroup[] = [
    {
      title: 'Core Tech',
      badges: [
        { label: 'Angular', src: 'https://img.shields.io/badge/Angular-DD0031?logo=angular&logoColor=white' },
        { label: 'TypeScript', src: 'https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white' },
        { label: 'Sass', src: 'https://img.shields.io/badge/Sass-CC6699?logo=sass&logoColor=white' },
      ],
    },
    {
      title: 'Backend & Platform',
      badges: [
        { label: 'Supabase', src: 'https://img.shields.io/badge/Supabase-000000?logo=supabase&logoColor=3ECF8E' },
        { label: 'Node.js', src: 'https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white' },
        { label: 'Vercel', src: 'https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white' },
      ],
    },
    {
      title: 'Tools',
      badges: [
        { label: 'Git', src: 'https://img.shields.io/badge/Git-F05032?logo=git&logoColor=white' },
        { label: 'GitHub', src: 'https://img.shields.io/badge/GitHub-181717?logo=github&logoColor=white' },
        { label: 'npm', src: 'https://img.shields.io/badge/npm-CB3837?logo=npm&logoColor=white' },
      ],
    },
  ];

  ngAfterViewInit() {
    this.sequentialBadgeGlow();
  }

  private sequentialBadgeGlow() {
    const badges = Array.from(document.querySelectorAll('.tech-badge img')) as HTMLElement[];
    if (!badges.length) return;

    let queue = [...badges]; // clone array
    const glowNext = () => {
      if (queue.length === 0) {
        queue = [...badges]; // reset queue after full cycle
      }

      // pick a random badge from queue
      const idx = Math.floor(Math.random() * queue.length);
      const badge = queue[idx];
      queue.splice(idx, 1); // remove from queue

      // glow badge
      badge.classList.add('hover-active');

      // remove glow after duration
      setTimeout(() => {
        badge.classList.remove('hover-active');
        setTimeout(glowNext, 500 + Math.random() * 1000); // next glow after 0.5–1.5s
      }, 1200 + Math.random() * 800); // glow duration 1.2–2s
    };

    glowNext(); // start first glow
  }
}
