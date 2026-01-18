import { Component, inject } from '@angular/core';
import { RouterOutlet } from "@angular/router";
import { Loader } from '../../shared/ui/common/loader/loader';
import { Toast } from '../../shared/ui/common/toast/toast';
import { Modal } from '../../shared/ui/common/modal/modal';

import { QuilixInstaller } from '../../shared/components/quilix-installer/quilix-installer';


@Component({
  selector: 'app-template',
  imports: [RouterOutlet, QuilixInstaller, Loader, Toast, Modal],
  templateUrl: './template.html',
  styleUrl: './template.scss',
})
export class PublicTemplate {

}
