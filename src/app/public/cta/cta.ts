import { Component, computed, signal } from '@angular/core';

export interface MarqueeCard {
    id: number;
    type: 'kanban' | 'graph' | 'note' | 'progress' | 'upcoming';
    title: string;
    content: any;
}

@Component({
    selector: 'app-cta',
    imports: [],
    templateUrl: './cta.html',
    styleUrl: './cta.scss',
})
export class Cta {
    private _baseCards = signal<MarqueeCard[]>([
        {
            id: 1,
            type: 'progress',
            title: 'Growth',
            content: [2, 15, 8, 25, 18, 40]
        },
        {
            id: 2,
            type: 'upcoming',
            title: 'Allocation',
            content: {
                percent: 75,
                graph: [10, 25, 15, 30, 20]
            }
        },
        {
            id: 3,
            type: 'kanban',
            title: 'Active Tasks',
            content: [
                { label: 'Core', progress: 100 },
                { label: 'API', progress: 55 },
                { label: 'UI', progress: 10 }
            ]
        },
        {
            id: 4,
            type: 'graph',
            title: 'Stats',
            content: [40, 70, 45, 90, 65]
        },
        {
            id: 5,
            type: 'note',
            title: 'Quick Note',
            content: 'Seamless infinite loop implementation.'
        }
    ]);


    public cards = computed(() => [...this._baseCards(), ...this._baseCards()]);
}
