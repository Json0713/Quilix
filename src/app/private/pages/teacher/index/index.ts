import { Component } from '@angular/core';
import { SpinnerService } from "../../../../services/ui/spinner/spinner";

@Component({
  selector: 'app-teacher-index',
  imports: [],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class TeacherIndex {

  constructor(private spinner: SpinnerService) {}

  loadData(): void {
    this.spinner.show();

    setTimeout(() => {
      this.spinner.hide();
    }, 11500);
  }

}
