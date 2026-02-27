import { Component, OnInit } from '@angular/core';

import { AuthService } from '../../../../core/auth/auth.service';
import { ModalService } from '../../../../services/ui/common/modal/modal';

@Component({
  selector: 'app-team-index',
  imports: [],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class TeamIndex implements OnInit {

  constructor(
    private auth: AuthService,
    private modal: ModalService,
  ) { }

  ngOnInit(): void {
    // Oninitialization logic can be added here if needed.
    // ...
  }

  async logout(): Promise<void> {
    const confirmed = await this.modal.confirm(
      'Are you sure you want to log out?',
      {
        title: 'Confirm Logout',
        confirmText: 'Logout',
        cancelText: 'Cancel',
      }
    );

    if (!confirmed) return;

    await this.auth.logout();
  }

}
