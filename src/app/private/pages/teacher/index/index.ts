import { Component } from '@angular/core';
import { SpinnerService } from "../../../../services/ui/spinner/spinner";
import { AuthService } from '../../../../core/auth/auth';
import { Router } from '@angular/router';
import { UserExportImportService } from '../../../../core/storage/export-import/user-export-import';
import { ExportImportService } from '../../../../core/storage/export-import/export-import';
import { ToastService } from '../../../../services/ui/toast/toast';
import { Toast } from '../../../../shared/ui/toast/toast';


@Component({
  selector: 'app-teacher-index',
  imports: [ Toast ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class TeacherIndex {

  constructor(
    private auth: AuthService,
    private router: Router,
    private spinner: SpinnerService,
    private ei: ExportImportService,
    private userEI: UserExportImportService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  loadData(): void {
    this.spinner.show();

    setTimeout(() => {
      this.spinner.hide();
    }, 1800);
  }

  async export(): Promise<void> {
    try {
      await this.ei.exportWorkspace();
      alert('Workspace exported successfully.');
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async exportUser(): Promise<void> {
    try {
      await this.userEI.exportCurrentUser();
      alert('User backup exported.');
    } catch (e) {
      alert((e as Error).message);
    }
  }

    //Error handling is done in interceptor
    success(): void {
    this.toast.success('Saved successfully');
  }

  error(): void {
    this.toast.error('Failed to load data');
  }

  warning(): void {
    this.toast.warning('Unsaved changes');
  }

  info(): void {
    this.toast.info('Loading profile…');
  }

}
