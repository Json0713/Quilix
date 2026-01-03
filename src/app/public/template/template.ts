import { Component } from '@angular/core';
import { RouterOutlet } from "@angular/router";
import { GlobalSpinner } from "../../shared/ui/common/global-spinner/global-spinner";

@Component({
  selector: 'app-template',
  imports: [RouterOutlet, GlobalSpinner],
  templateUrl: './template.html',
  styleUrl: './template.scss',
})
export class PublicTemplate {

}

