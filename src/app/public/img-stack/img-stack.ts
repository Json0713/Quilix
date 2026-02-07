import { Component, ChangeDetectionStrategy } from '@angular/core';

interface Tech {
  src: string;
  alt: string;
}

@Component({
  selector: 'app-img-stack',
  imports: [],
  templateUrl: './img-stack.html',
  styleUrl: './img-stack.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImgStack {
  readonly technologies: Tech[] = [
    { src: 'assets/icons/favicon-96x96.png', alt: 'Angular' },
    { src: 'assets/icons/favicon-96x96.png', alt: 'TypeScript' },
    { src: 'assets/icons/favicon-96x96.png', alt: 'Sass' },
    { src: 'assets/icons/favicon-96x96.png', alt: 'Node.js' },
    { src: 'assets/icons/favicon-96x96.png', alt: 'npm' },
    { src: 'assets/icons/favicon-96x96.png', alt: 'Supabase' },
    { src: 'assets/icons/favicon-96x96.png', alt: 'Vercel' },
    { src: 'assets/icons/favicon-96x96.png', alt: 'GitHub' },
  ];
}
