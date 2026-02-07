import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Header } from '../common/header/header';
import { Footer } from '../common/footer/footer';
import { QuilixVersionService } from '../../core/quilix-installer/version/quilix-version.service';
import { ThemeToggle } from '../../shared/ui/system/theme-toggle/theme-toggle';
import { Feature } from "../feature/feature";

@Component({
  selector: 'app-public-index',
  imports: [RouterModule, ThemeToggle, Header, Footer, Feature],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class PublicIndex {

  constructor(
    public version: QuilixVersionService
  ) {}

}
