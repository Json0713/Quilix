import { Component } from '@angular/core';
import { AuthFacade } from '../../../../core/auth/auth.facade';
import { ModalService } from '../../../../services/ui/common/modal/modal';
import { LoaderService } from '../../../../services/ui/common/loader/loader';
import { Export } from '../../../../shared/components/export/export';


@Component({
  selector: 'app-teacher-index',
  imports: [Export],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class TeacherIndex {

  constructor(
    private auth: AuthFacade,
    private loader: LoaderService,
    private modal: ModalService,
  ) {}

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

    this.auth.logout();
  }


}
