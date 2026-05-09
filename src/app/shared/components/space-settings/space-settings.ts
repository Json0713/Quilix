import { Component, Input, Output, EventEmitter, signal, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SpacePreferences, DEFAULT_SPACE_PREFERENCES } from '../../../core/interfaces/space-preferences';

@Component({
    selector: 'app-space-settings',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './space-settings.html',
    styleUrl: './space-settings.scss'
})
export class SpaceSettingsComponent implements OnChanges {
    @Input() preferences: SpacePreferences = { ...DEFAULT_SPACE_PREFERENCES };
    @Input() isVisible = false;
    @Output() preferencesChange = new EventEmitter<SpacePreferences>();

    currentView = signal<'menu' | 'general' | 'appearance'>('menu');

    ngOnChanges(changes: SimpleChanges) {
        if (changes['isVisible'] && changes['isVisible'].currentValue) {
            this.currentView.set('menu');
        }
    }

    navigateTo(view: 'menu' | 'general' | 'appearance') {
        this.currentView.set(view);
    }

    updatePreference<K extends keyof SpacePreferences>(key: K, value: SpacePreferences[K]) {
        this.preferences = { ...this.preferences, [key]: value };
        this.preferencesChange.emit(this.preferences);
    }
}
