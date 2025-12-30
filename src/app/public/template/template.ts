import { Component } from '@angular/core';
import { RouterOutlet } from "@angular/router";
import { Header } from "../common/header/header";

@Component({
  selector: 'app-template',
  imports: [RouterOutlet, Header],
  templateUrl: './template.html',
  styleUrl: './template.scss',
})
export class PublicTemplate {

}
