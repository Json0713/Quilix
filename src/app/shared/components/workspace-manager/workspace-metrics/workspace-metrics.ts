import { Component, Input } from '@angular/core';

@Component({
    selector: 'app-workspace-metrics',
    standalone: true,
    templateUrl: './workspace-metrics.html',
    styleUrls: ['./workspace-metrics.scss']
})
export class WorkspaceMetricsComponent {
    @Input({ required: true }) totalWorkspaces!: number;
    @Input({ required: true }) syncedFolders!: number;
    @Input({ required: true }) missingFolders!: number;
    @Input({ required: true }) totalSpaces!: number;
    @Input({ required: true }) isFileSystemMode!: boolean;
}
