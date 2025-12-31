import { Component } from '@angular/core';
import { SpinnerService } from "../../../../services/ui/spinner/spinner";
import { AuthService } from '../../../../core/auth/auth';
import { Router } from '@angular/router';

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
    private spinner: SpinnerService
  ) {}

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  loadData(): void {
    this.spinner.show();

    setTimeout(() => {
      this.spinner.hide();
    }, 3500);
  }

}
