import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { db } from '../../../core/db/app-db';

@Component({
    selector: 'app-cta-contact',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './cta-contact.html',
    styleUrl: './cta-contact.scss',
})
export class CtaContact {
    form = {
        name: '',
        email: '',
        message: ''
    };

    isSubmitting = false;
    isSuccess = false;

    async onSubmit() {
        if (!this.form.name || !this.form.email || !this.form.message) return;

        this.isSubmitting = true;

        try {
            await db.contacts.add({
                id: crypto.randomUUID(),
                name: this.form.name,
                email: this.form.email,
                message: this.form.message,
                createdAt: Date.now()
            });

            // Simulate a brief network delay for premium feel
            setTimeout(() => {
                this.isSubmitting = false;
                this.isSuccess = true;
            }, 800);

        } catch (e) {
            console.error('Failed to save contact message', e);
            this.isSubmitting = false;
        }
    }
}
