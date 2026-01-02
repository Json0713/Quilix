import { Component } from '@angular/core';
import { SpinnerService } from "../../../../services/ui/spinner/spinner";
import { AuthService } from '../../../../core/auth/auth';
import { Router } from '@angular/router';
import { ExportImportService } from '../../../../core/storage/export-import/export-import';
import { UserExportImportService } from '../../../../core/storage/export-import/user-export-import';

@Component({
  selector: 'app-student-index',
  imports: [],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class StudentIndex {

  constructor(
    private auth: AuthService,
    private router: Router,
    private spinner: SpinnerService,
    private ei: ExportImportService,
    private userEI: UserExportImportService
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

}
