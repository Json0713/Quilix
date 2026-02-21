import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { QuilixVersionService } from '../../../core/quilix-installer/version/quilix-version.service';

@Component({
  selector: 'public-meta-index',
  imports: [RouterModule],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class PublicMetaIndex {
  constructor(
    public version: QuilixVersionService
  ) { }
}
