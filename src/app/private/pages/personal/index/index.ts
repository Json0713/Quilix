import { Component, OnInit } from '@angular/core';

import { AuthService } from '../../../../core/auth/auth.service';
import { ModalService } from '../../../../services/ui/common/modal/modal';
import { LoaderService } from '../../../../services/ui/common/loader/loader';
import { Export } from "../../../../shared/components/export/export";

@Component({
  selector: 'app-personal-index',
  imports: [Export],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class PersonalIndex implements OnInit {

  constructor(
    private auth: AuthService,
    private loader: LoaderService,
    private modal: ModalService,
  ) { }

  ngOnInit(): void {
    // Data loading happens naturally through component lifecycle
    // No artificial delays needed
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
