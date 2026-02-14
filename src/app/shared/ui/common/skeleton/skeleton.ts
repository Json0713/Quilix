import { Component, Input } from '@angular/core';

export type SkeletonVariant = 'text' | 'circular' | 'rectangular' | 'card' | 'button';

@Component({
    selector: 'app-skeleton',
    imports: [],
    templateUrl: './skeleton.html',
    styleUrl: './skeleton.scss',
})
export class Skeleton {

    @Input() variant: SkeletonVariant = 'text';
    @Input() width: string = '100%';
    @Input() height: string = '1rem';
    @Input() count: number = 1;
    @Input() animate: boolean = true;

    get items(): number[] {
        return Array.from({ length: this.count }, (_, i) => i);
    }

}
