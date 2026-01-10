import { Component } from '@angular/core';
import { SpinnerService } from "../../../../services/ui/common/spinner/spinner";
import { AuthService } from '../../../../core/auth/auth';
import { Router } from '@angular/router';
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

}
