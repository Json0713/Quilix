import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GlobalSpinner } from '../../../../shared/ui/common/global-spinner/global-spinner';
import { Toast } from '../../../../shared/ui/common/toast/toast';
import { Modal } from "../../../../shared/ui/common/modal/modal";


@Component({
  selector: 'app-teacher-template',
  imports: [RouterOutlet, GlobalSpinner, Toast, Modal],
  templateUrl: './template.html',
  styleUrl: './template.scss',
})
export class TeacherTemplate {

}
