import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Spinner } from '../../../../shared/ui/spinner/spinner';

@Component({
  selector: 'app-student-template',
  imports: [RouterOutlet, Spinner],
  templateUrl: './template.html',
  styleUrl: './template.scss',
})
export class StudentTemplate {

}
