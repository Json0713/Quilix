import { Component } from '@angular/core';
import { SpinnerService } from "../../../../services/ui/spinner/spinner";
import { AuthService } from '../../../../core/auth/auth';
import { Router } from '@angular/router';
import { ExportImportService } from '../../../../core/storage/export-import/export-import';
import { UserExportImportService } from '../../../../core/storage/export-import/user-export-import';
import { ToastService } from '../../../../services/ui/toast/toast';
import { Toast } from "../../../../shared/ui/common/toast/toast";

@Component({
  selector: 'app-student-index',
  imports: [Toast],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class StudentIndex {

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

  // Import-Export Testing
  async export(): Promise<void> {
    try {
      await this.ei.exportWorkspace();
      this.toast.success('Workspace exported successfully.');
    } catch (e) {
      this.toast.error((e as Error).message || 'Export failed.');
    }
  }

  async exportUser(): Promise<void> {
    try {
      await this.userEI.exportCurrentUser();
      this.toast.success('User backup exported.');
    } catch (e) {
      this.toast.error((e as Error).message || 'User export failed.');
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
