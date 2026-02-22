import { Component, inject } from '@angular/core';
import { QuilixInstallerService } from '../../../core/quilix-installer/quilix-installer.service';
import { QuilixInstallerState } from '../../../core/quilix-installer/quilix-installer.state';

@Component({
    selector: 'app-cta-download',
    standalone: true,
    templateUrl: './cta-download.html',
    styleUrl: './cta-download.scss',
})
export class CtaDownload {
    private readonly installer = inject(QuilixInstallerService);
    readonly state = inject(QuilixInstallerState);

    async install(): Promise<void> {
        await this.installer.requestInstall();
    }
}
