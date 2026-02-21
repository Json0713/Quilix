import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-cta-footer',
    standalone: true,
    imports: [RouterModule],
    templateUrl: './cta-footer.html',
    styleUrl: './cta-footer.scss',
})
export class CtaFooter {
    currentYear = new Date().getFullYear();
}
