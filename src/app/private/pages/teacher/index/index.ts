import { Component } from '@angular/core';
import { AuthFacade } from '../../../../core/auth/auth.facade';
import { SpinnerService } from "../../../../services/ui/common/spinner/spinner";
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
    private spinner: SpinnerService,
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.spinner.show();

    setTimeout(() => {
      this.spinner.hide();
    }, 1800);
  }

  logout(): void {
    this.auth.logout();
  }

}
