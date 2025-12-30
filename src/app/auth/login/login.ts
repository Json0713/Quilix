import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth';
import { UserRole } from '../../core/interfaces/user';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  
  name = '';
  role: UserRole | null = null;

  constructor(
    private auth: AuthService,
    private router: Router
  ) {}

  isValid(): boolean {
    return this.name.trim().length >= 2 && !!this.role;
  }

  submit(): void {
    if (!this.isValid()) return;

    const user = this.auth.login(this.name, this.role!);

    if (user.role === 'student') {
      this.router.navigate(['/student']);
    } else {
      this.router.navigate(['/teacher']);
    }
  }

}
