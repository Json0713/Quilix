import { Component } from '@angular/core';
import { WorkspaceManagerComponent } from '../../../../shared/components/workspace-manager/workspace-manager';

@Component({
    selector: 'app-personal-workspaces',
    standalone: true,
    imports: [WorkspaceManagerComponent],
    template: `<app-workspace-manager />`,
    styles: [`:host { display: contents; }`]
})
export class PersonalWorkspaces { }
