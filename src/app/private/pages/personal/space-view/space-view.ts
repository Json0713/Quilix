import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { SpaceService } from '../../../../core/services/space.service';
import { Space } from '../../../../core/interfaces/space';

@Component({
    selector: 'app-personal-space-view',
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
    private spaceSub: any;

    ngOnInit() {
        this.paramSub = this.route.params.subscribe(params => {
            const spaceId = params['spaceId'];
            this.loading.set(true);

            // Tear down previous live subscription
            this.spaceSub?.unsubscribe();

            if (spaceId) {
                // Reactive: updates when space is renamed, trashed, or deleted
                this.spaceSub = this.spaceService.liveSpace$(spaceId).subscribe(
                    (space: Space | null) => {
                        this.space.set(space);
                        this.loading.set(false);
                    }
                );
            } else {
                this.space.set(null);
                this.loading.set(false);
            }
        });
    }

    ngOnDestroy() {
        this.paramSub?.unsubscribe();
        this.spaceSub?.unsubscribe();
    }
}
