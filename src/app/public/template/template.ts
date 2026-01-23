import { Component } from '@angular/core';
import { RouterOutlet } from "@angular/router";

import { QuilixInstaller } from '../../shared/components/quilix-installer/quilix-installer';


@Component({
  selector: 'app-template',
  imports: [RouterOutlet, QuilixInstaller],
  templateUrl: './template.html',
  styleUrl: './template.scss',
})
export class PublicTemplate {

}
