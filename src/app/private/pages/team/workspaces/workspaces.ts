import { Component } from '@angular/core';
import { WorkspaceManagerComponent } from '../../../../shared/components/workspace-manager/workspace-manager';

@Component({
    selector: 'app-team-workspaces',
    standalone: true,
    imports: [WorkspaceManagerComponent],
    template: `<app-workspace-manager />`,
})
export class TeamWorkspaces { }
