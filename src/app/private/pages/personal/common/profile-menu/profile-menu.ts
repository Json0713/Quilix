import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../../core/auth/auth.service';
import { SidebarService } from '../../../../../core/sidebar/sidebar.service';

@Component({
  selector: 'app-personal-profile-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile-menu.html',
  styleUrl: './profile-menu.scss',
})
export class PersonalProfileMenuComponent {
  private authService = inject(AuthService);
  private sidebarService = inject(SidebarService);
  
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
    this.sidebarService.closeMobile();
    await this.authService.logout();
  }
}
