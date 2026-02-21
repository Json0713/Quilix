import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { QuilixVersionService } from '../../core/quilix-installer/version/quilix-version.service';

@Component({
    selector: 'app-cta-meta',
    imports: [RouterModule],
    templateUrl: './cta-meta.html',
    styleUrl: './cta-meta.scss',
})
export class CtaMeta {

    constructor(
        public version: QuilixVersionService
    ) { }

}
