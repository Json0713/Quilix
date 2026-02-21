import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-cta-tech',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './cta-tech.html',
    styleUrl: './cta-tech.scss',
})
export class CtaTech {
    techStack = [
        { label: 'Angular', icon: 'bi-rocket-takeoff-fill', color: '#dd0031' },
        { label: 'Supabase', icon: 'bi-database-fill', color: '#3ecf8e' },
        { label: 'Dexie Local', icon: 'bi-hdd-network-fill', color: '#3b82f6' },
        { label: 'PWA Ready', icon: 'bi-phone-fill', color: '#f59e0b' },
        { label: 'Bootstrap', icon: 'bi-bootstrap-fill', color: '#712cf9' },
        { label: 'Vercel', icon: 'bi-triangle-fill', color: '#ffffff' },
        { label: 'TypeScript', icon: 'bi-filetype-tsx', color: '#3178c6' },
        { label: 'SCSS', icon: 'bi-filetype-scss', color: '#c6538c' },
    ];
}
