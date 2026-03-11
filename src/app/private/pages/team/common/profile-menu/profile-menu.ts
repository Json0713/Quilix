import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../../core/auth/auth.service';

@Component({
  selector: 'app-team-profile-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile-menu.html',
  styleUrl: './profile-menu.scss',
})
export class TeamProfileMenuComponent {
  private authService = inject(AuthService);
  
  isOpen = signal<boolean>(false);

  toggleMenu(event: MouseEvent) {
    event.stopPropagation();
    this.isOpen.update(v => !v);
  }

  @HostListener('document:click')
  onDocumentClick() {
    if (this.isOpen()) {
      this.isOpen.set(false);
    }
  }

  async logout() {
    this.isOpen.set(false);
    await this.authService.logout();
  }
}
