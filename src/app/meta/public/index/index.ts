import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { QuilixVersionService } from '../../../core/quilix-installer/version/quilix-version.service';
import { CtaQuilix } from '../cta-quilix/cta-quilix';
import { CtaTech } from '../cta-tech/cta-tech';
import { CtaContact } from '../cta-contact/cta-contact';
import { CtaFooter } from '../cta-footer/cta-footer';

@Component({
  selector: 'public-meta-index',
  imports: [RouterModule, CtaQuilix, CtaTech, CtaContact, CtaFooter],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class PublicMetaIndex {
  constructor(
    public version: QuilixVersionService
  ) { }
}
