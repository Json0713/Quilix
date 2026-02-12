import { Component, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { MetaAuthService } from '../../core/auth/meta-auth.service';
import { MetaUserRole } from '../../interfaces/meta-role';

@Component({
  selector: 'app-register-meta',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register-meta.html',
  styleUrls: ['./register-meta.scss'],
})
export class RegisterMeta implements OnDestroy {

  registerForm: FormGroup;
  error: string | null = null;
  loading = false;

  countryCodes = [
    { code: '+63', label: 'PH' },
    { code: 'Other', label: 'Other' }
  ];

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly auth: MetaAuthService,
    private readonly router: Router,
    private readonly fb: FormBuilder
  ) {
    this.registerForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
      countryCode: ['+63'],
      phone: ['', [this.phoneValidator.bind(this)]],
      role: ['personal' as MetaUserRole, [Validators.required]]
    }, { validators: this.passwordMatchValidator });

    // reset phone validation when country code changes
    this.registerForm.get('countryCode')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.registerForm.get('phone')?.updateValueAndValidity();
        // Re-run input logic to strip excess characters if switching back to PH
        const currentPhone = this.f['phone'].value;
        if (currentPhone) {
          // trigger re-eval of length
          this.sanitizePhoneInput(currentPhone);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Custom Validator
  passwordMatchValidator(control: AbstractControl): { [key: string]: boolean } | null {
    const password = control.get('password');
    const confirm = control.get('confirmPassword');
    if (!password || !confirm) return null;
    return password.value === confirm.value ? null : { 'mismatch': true };
  }

  // Phone Validator
  phoneValidator(control: AbstractControl): { [key: string]: boolean } | null {
    if (!control.value) return null;

    const form = this.registerForm;
    if (!form) return null;

    const countryCode = form.get('countryCode')?.value;
    const value = control.value as string;

    if (countryCode === '+63') {
      const phRegex = /^(0?9)\d{9}$/;
      return phRegex.test(value) ? null : { 'invalidPhPhone': true };
    }

    return null;
  }

  // Helper to restrict input to numbers and enforce length
  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.sanitizePhoneInput(input.value);
  }

  private sanitizePhoneInput(rawValue: string): void {
    let value = rawValue.replace(/[^0-9]/g, '');
    const countryCode = this.f['countryCode'].value;

    if (countryCode === '+63') {
      // If starts with 9, max 10 digits (9123456789)
      // If starts with 0, max 11 digits (09123456789)
      if (value.startsWith('9')) {
        if (value.length > 10) value = value.slice(0, 10);
      } else if (value.startsWith('0')) {
        if (value.length > 11) value = value.slice(0, 11);
      } else {
        // Fallback for non-standard starts, cap at 11
        if (value.length > 11) value = value.slice(0, 11);
      }
    } else {
      // Other: generous max length
      if (value.length > 15) value = value.slice(0, 15);
    }

    // Update control if value changed
    if (this.f['phone'].value !== value) {
      this.f['phone'].setValue(value);
    }
  }

  // Getters for easier access in template
  get f() { return this.registerForm.controls; }

  // Progress logic
  get progress(): number {
    let completed = 0;
    const total = 4;

    if (this.f['username'].valid) completed++;
    if (this.f['email'].valid) completed++;
    if (this.f['password'].valid) completed++;
    if (this.registerForm.hasError('mismatch') === false && this.f['confirmPassword'].valid) completed++;

    return (completed / total) * 100;
  }

  get progressColor(): string {
    if (this.progress < 50) return 'var(--danger)';
    if (this.progress < 100) return 'var(--warning)';
    return 'var(--success)';
  }

  async submit(): Promise<void> {
    if (this.registerForm.invalid || this.loading) return;

    this.loading = true;
    this.error = null;

    const raw = this.registerForm.getRawValue();

    // Format Phone
    let finalPhone = raw.phone;
    if (finalPhone && raw.countryCode === '+63') {
      const cleanNumber = finalPhone.replace(/^0/, '');
      finalPhone = '+63' + cleanNumber;
    } else if (finalPhone && raw.countryCode !== 'Other') {
      finalPhone = raw.countryCode + raw.phone;
    }

    const { email, password, username, role } = raw;

    const result = await this.auth.register(
      email,
      password,
      {
        username: username.trim(),
        role: role,
        phone: finalPhone?.trim() || undefined
      }
    );

    this.loading = false;

    if (!result.success) {
      this.error = result.error ?? 'Registration failed';
      return;
    }

    await this.router.navigate(['/meta/login'], {
      queryParams: { registered: '1' }
    });
  }

}
