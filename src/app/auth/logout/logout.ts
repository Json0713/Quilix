import { Component, OnInit  } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-logout',
  imports: [],
  templateUrl: './logout.html',
  styleUrl: './logout.scss',
})
export class Logout implements OnInit {

  constructor (
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.auth.logout();
    this.router.navigate(['/login'], { replaceUrl: true });
  }

}
