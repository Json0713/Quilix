import { Component } from '@angular/core';

@Component({
    selector: 'app-valentines',
    imports: [],
    templateUrl: './valentines.html',
    styleUrl: './valentines.scss',
    standalone: true
})
export class Valentines {

    // Generate random hearts for animation
    hearts = Array.from({ length: 15 }, (_, i) => ({
        id: i,
        delay: Math.random() * 5,
        duration: 8 + Math.random() * 4,
        left: Math.random() * 100,
        size: 0.5 + Math.random() * 1
    }));

}
