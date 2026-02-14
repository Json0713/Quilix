import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Header } from '../common/header/header';
import { Footer } from '../common/footer/footer';
import { QuilixVersionService } from '../../core/quilix-installer/version/quilix-version.service';
import { ThemeToggle } from '../../shared/ui/system/theme-toggle/theme-toggle';
import { Feature } from "../feature/feature";
import { CtaStack } from "../cta-stack/cta-stack";
import { ImgStack } from "../img-stack/img-stack";
import { CtaKeyboard } from "../cta-keyboard/cta-keyboard";
import { Valentines } from "../valentines/valentines";

@Component({
  selector: 'app-public-index',
  imports: [RouterModule, ThemeToggle, Header, Footer, Feature, CtaStack, ImgStack, CtaKeyboard, Valentines],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class PublicIndex {

  constructor(
    public version: QuilixVersionService
  ) {}

}
