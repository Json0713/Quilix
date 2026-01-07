import { Component } from '@angular/core';
import { SpinnerService } from "../../../../services/ui/common/spinner/spinner";
import { AuthService } from '../../../../core/auth/auth';
import { Router } from '@angular/router';
import { UserExportImportService } from '../../../../services/components/export-import/user-export-import';
import { ExportImportService } from '../../../../services/components/export-import/export-import';
import { ToastService } from '../../../../services/ui/common/toast/toast';
import { Export } from "../../../../shared/components/export/export";

@Component({
  selector: 'app-student-index',
  imports: [Export],
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
