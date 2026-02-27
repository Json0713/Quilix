import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { SpaceService } from '../../../../core/services/space.service';
import { Space } from '../../../../core/interfaces/space';

@Component({
    selector: 'app-space-view',
    standalone: true,
    imports: [],
    templateUrl: './space-view.html',
    styleUrl: './space-view.scss',
})
export class SpaceView implements OnInit, OnDestroy {
    private route = inject(ActivatedRoute);
    private spaceService = inject(SpaceService);

    space = signal<Space | null>(null);
    loading = signal(true);

    private paramSub!: Subscription;

    ngOnInit() {
        this.paramSub = this.route.params.subscribe(async params => {
            const spaceId = params['spaceId'];
            this.loading.set(true);

            if (spaceId) {
                const found = await this.spaceService.getById(spaceId);
                this.space.set(found);
            }

            this.loading.set(false);
        });
    }

    ngOnDestroy() {
        this.paramSub?.unsubscribe();
    }
}
