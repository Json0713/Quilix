import { Component, Input, Output, EventEmitter, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivityRecord } from '../../../../../core/interfaces/activity';

export interface DayBucket {
    date: Date;
    count: number;
    types: { [key: string]: number };
    intensity: number; // 0-1
    isToday: boolean;
    isSelected: boolean;
}

@Component({
    selector: 'app-activity-graph',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './activity-graph.html',
    styleUrl: './activity-graph.scss'
})
export class ActivityGraph {
    @Input() set activities(value: ActivityRecord[]) {
        this._activities.set(value);
    }
    @Output() onRangeSelected = new EventEmitter<{ start: number, end: number } | null>();

    private _activities = signal<ActivityRecord[]>([]);
    
    // Default to the last 7 days window
    currentWindowEnd = signal<number>(this.getStartOfToday());
    selectedDate = signal<number | null>(null);

    // Generate buckets for the current 7-day window
    buckets = computed(() => {
        const end = this.currentWindowEnd();
        const activityList = this._activities();
        const results: DayBucket[] = [];
        const today = this.getStartOfToday();

        // Generate 7 days ending at currentWindowEnd
        for (let i = 6; i >= 0; i--) {
            const date = new Date(end);
            date.setDate(date.getDate() - i);
            const startTime = date.getTime();
            const endTime = startTime + 86400000;

            const dayActivities = activityList.filter(a => a.timestamp >= startTime && a.timestamp < endTime);
            
            const types: { [key: string]: number } = {};
            dayActivities.forEach(a => {
                types[a.type] = (types[a.type] || 0) + 1;
            });

            results.push({
                date,
                count: dayActivities.length,
                types,
                intensity: 0, // Calculated below
                isToday: startTime === today,
                isSelected: this.selectedDate() === startTime
            });
        }

        // Calculate intensity relative to the maximum in this window
        const maxCount = Math.max(...results.map(b => b.count), 1);
        results.forEach(b => b.intensity = b.count / maxCount);

        return results;
    });

    // SVG Path Calculation for Curved Line Graph
    curvePath = computed(() => {
        const buckets = this.buckets();
        if (buckets.length === 0) return '';

        const points = buckets.map((b, i) => ({
            x: i * (100 / (buckets.length - 1)),
            y: 100 - (b.intensity * 90) - 5
        }));

        if (points.length < 2) return '';

        // Generate Cubic Bezier path
        let path = `M ${points[0].x},${points[0].y}`;

        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i - 1] || points[i];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[i + 2] || p2;

            // Control points (tension = 0.2)
            const cp1x = p1.x + (p2.x - p0.x) * 0.15;
            const cp1y = p1.y + (p2.y - p0.y) * 0.15;

            const cp2x = p2.x - (p3.x - p1.x) * 0.15;
            const cp2y = p2.y - (p3.y - p1.y) * 0.15;

            path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
        }

        return path;
    });

    get windowLabel(): string {
        const b = this.buckets();
        if (b.length === 0) return '';
        const start = b[0].date;
        const end = b[b.length - 1].date;
        return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    }

    selectDay(bucket: DayBucket) {
        if (this.selectedDate() === bucket.date.getTime()) {
            // Deselect
            this.selectedDate.set(null);
            this.onRangeSelected.emit(null);
        } else {
            const start = bucket.date.getTime();
            this.selectedDate.set(start);
            this.onRangeSelected.emit({
                start,
                end: start + 86400000
            });
        }
    }

    moveWindow(days: number) {
        const current = new Date(this.currentWindowEnd());
        current.setDate(current.getDate() + days);
        this.currentWindowEnd.set(current.getTime());
    }

    resetToToday() {
        this.currentWindowEnd.set(this.getStartOfToday());
    }

    private getStartOfToday(): number {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    }

    getBarColor(bucket: DayBucket): string {
        if (bucket.count === 0) return 'var(--sc-graph-empty)';
        
        // Find dominant type for color
        const types = bucket.types;
        const keys = Object.keys(types);
        if (keys.length === 0) return 'var(--sc-graph-empty)';

        const dominant = keys.reduce((a, b) => types[a] > types[b] ? a : b);
        
        switch (dominant) {
            case 'create':
            case 'restore':
                return '#10b981'; // Green
            case 'delete':
            case 'trash':
                return '#ef4444'; // Red
            case 'rename':
            case 'move':
                return '#3b82f6'; // Blue
            default:
                return 'var(--bs-primary)';
        }
    }
}
