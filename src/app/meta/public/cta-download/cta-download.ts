import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QuilixInstallerService } from '../../../core/quilix-installer/quilix-installer.service';
import { QuilixInstallerState } from '../../../core/quilix-installer/quilix-installer.state';

@Component({
    selector: 'app-cta-download',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './cta-download.html',
    styleUrl: './cta-download.scss',
})
export class CtaDownload {
    constructor(
        readonly installer: QuilixInstallerService,
        readonly state: QuilixInstallerState
    ) { }

    async install(): Promise<void> {
        try {
            await this.installer.requestInstall();
        } catch (err) {
            console.error('CtaDownload: Installation failed', err);
        }
    }
}
