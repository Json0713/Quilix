import { Component } from '@angular/core';
import { RouterOutlet } from "@angular/router";
import { Toast } from '../../shared/ui/common/toast/toast';
import { Modal } from '../../shared/ui/common/modal/modal';

@Component({
  selector: 'app-template',
  imports: [RouterOutlet, Toast, Modal],
  templateUrl: './template.html',
  styleUrl: './template.scss',
})
export class PublicTemplate {

}

