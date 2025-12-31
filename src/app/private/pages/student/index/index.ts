import { Component } from '@angular/core';
import { SpinnerService } from "../../../../services/ui/spinner/spinner";

@Component({
  selector: 'app-student-index',
  imports: [],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class StudentIndex {
  constructor(private spinner: SpinnerService) {}

  loadData(): void {
    this.spinner.show();

    setTimeout(() => {
      this.spinner.hide();
    }, 11500);
  }

}
