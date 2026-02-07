import { Component, ChangeDetectionStrategy } from '@angular/core';

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
export class CtaStack {
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
        { label: 'Supabase', src: 'https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white' },
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
}
