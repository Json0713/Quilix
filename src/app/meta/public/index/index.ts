import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { QuilixVersionService } from '../../../core/quilix-installer/version/quilix-version.service';
import { CtaQuilix } from '../cta-quilix/cta-quilix';

@Component({
  selector: 'public-meta-index',
  imports: [RouterModule, CtaQuilix],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class PublicMetaIndex {
  constructor(
    public version: QuilixVersionService
  ) { }
}
