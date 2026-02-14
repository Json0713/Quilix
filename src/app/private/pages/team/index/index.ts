import { Component, OnInit } from '@angular/core';

import { AuthService } from '../../../../core/auth/auth.service';
import { ModalService } from '../../../../services/ui/common/modal/modal';
import { LoaderService } from '../../../../services/ui/common/loader/loader';
import { Export } from "../../../../shared/components/export/export";

@Component({
  selector: 'app-team-index',
  imports: [Export],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class TeamIndex implements OnInit {

  constructor(
    private auth: AuthService,
    private loader: LoaderService,
    private modal: ModalService,
  ) { }

  ngOnInit(): void {
    this.loadData();

  }

  loadData(): void {
    this.loader.show();

    setTimeout(() => {
      this.loader.hide();
    }, 1800);
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
