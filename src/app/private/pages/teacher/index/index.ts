import { Component } from '@angular/core';
import { SpinnerService } from "../../../../services/ui/spinner/spinner";
import { AuthService } from '../../../../core/auth/auth';
import { Router } from '@angular/router';
import { UserExportImportService } from '../../../../core/storage/user-export-import';
import { ExportImportService } from '../../../../core/storage/export-import';

@Component({
  selector: 'app-teacher-index',
  imports: [],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class TeacherIndex {

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

    export(): void {
    this.ei.exportWorkspace();
    alert('Workspace exported successfully.');
  }

  exportUser(): void {
    this.userEI.exportCurrentUser();
    alert('User backup exported.');
  }

}
