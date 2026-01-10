import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Loader } from '../../../../shared/ui/common/loader/loader';
import { Toast } from '../../../../shared/ui/common/toast/toast';
import { Modal } from "../../../../shared/ui/common/modal/modal";


@Component({
  selector: 'app-teacher-template',
  imports: [RouterOutlet, Loader, Toast, Modal],
  templateUrl: './template.html',
  styleUrl: './template.scss',
})
export class TeacherTemplate {

}
