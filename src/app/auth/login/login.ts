import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

import { WorkspaceRole } from '../../core/interfaces/workspace';
import { WorkspaceVisualComponent } from './workspace-visual/workspace-visual';
import { CreateWorkspaceComponent } from './create-workspace/create-workspace';
import { RecentWorkspacesComponent } from './recent-workspaces/recent-workspaces';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    WorkspaceVisualComponent,
    CreateWorkspaceComponent,
    RecentWorkspacesComponent
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  currentView: 'recent' | 'create' = 'recent';

  constructor(private router: Router) { }

  private redirect(role: WorkspaceRole): void {
    this.router.navigate([role === 'personal' ? '/personal' : '/team']);
  }

  onWorkspaceLoggedIn(role: WorkspaceRole): void {
    this.redirect(role);
  }

  onWorkspaceCreated(role: WorkspaceRole): void {
    this.redirect(role);
  }

  switchToCreate(): void {
    this.currentView = 'create';
  }

  switchToRecent(): void {
    this.currentView = 'recent';
  }
}
