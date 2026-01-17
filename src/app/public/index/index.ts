import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Header } from '../common/header/header';
import { Footer } from '../common/footer/footer';
import { QuilixVersionService } from '../../core/quilix-installer/version/quilix-version.service';

@Component({
  selector: 'app-public-index',
  imports: [RouterModule, Header, Footer],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class PublicIndex {

  constructor(public version: QuilixVersionService) {}

  
}
