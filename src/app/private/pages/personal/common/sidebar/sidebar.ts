import { Component, inject, signal, OnInit, OnDestroy, ElementRef, ViewChild, HostListener } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarService } from '../../../../../core/sidebar/sidebar.service';
import { AuthService } from '../../../../../core/auth/auth.service';
import { SpaceService } from '../../../../../core/services/space.service';
import { TabService } from '../../../../../core/services/tab.service';
import { Space } from '../../../../../core/interfaces/space';
import { Workspace } from '../../../../../core/interfaces/workspace';
import { SettingsKitComponent } from '../settings-kit/settings-kit';

@Component({
    selector: 'app-personal-sidebar',
    standalone: true,
    imports: [RouterLink, RouterLinkActive, CommonModule, FormsModule, SettingsKitComponent],
    templateUrl: './sidebar.html',
    styleUrl: './sidebar.scss',
})
export class PersonalSidebarComponent implements OnInit, OnDestroy {
    private sidebarService = inject(SidebarService);
    private authService = inject(AuthService);
    private spaceService = inject(SpaceService);
    private tabService = inject(TabService);

    isCollapsed = this.sidebarService.isCollapsed;
    isMobileOpen = this.sidebarService.isMobileOpen;

    navItems = [
        { label: 'Home', icon: 'bi bi-house', route: './' },
        { label: 'Tasks', icon: 'bi bi-list-check', route: './tasks' },
        { label: 'Workspaces', icon: 'bi bi-folder2-open', route: './workspaces' },
    ];

    // ── Spaces state ──
    activeWorkspace = signal<Workspace | null>(null);
    spaces = signal<Space[]>([]);
    isCreating = signal<boolean>(false);
    newSpaceName = signal<string>('');
    inputError = signal<string | null>(null);

    // ── Context menu state ──
    openMenuId = signal<string | null>(null);

    @ViewChild('spaceInput') spaceInputRef!: ElementRef<HTMLInputElement>;

    private spaceSub: any;

    async ngOnInit() {
        const workspace = await this.authService.getCurrentWorkspace();
        if (workspace) {
            this.activeWorkspace.set(workspace);
            this.spaceSub = this.spaceService.liveSpaces$(workspace.id).subscribe(
                (list: Space[]) => this.spaces.set(list)
            );
        }
    }

    ngOnDestroy() {
        this.spaceSub?.unsubscribe();
    }

    // Close dropdown on outside click
    @HostListener('document:click')
    onDocumentClick() {
        if (this.openMenuId()) {
            this.openMenuId.set(null);
        }
    }

    toggleSidebar() {
        if (this.isMobileOpen()) {
            this.sidebarService.closeMobile();
        } else {
            this.sidebarService.toggleCollapsed();
        }
    }

    onItemClick() {
        this.sidebarService.closeMobile();
    }

    onNavClick(item: { label: string; icon: string; route: string }) {
        // Just update tab metadata — routerLink handles navigation
        this.tabService.updateActiveTabRoute(item.route, item.label, item.icon);
        this.sidebarService.closeMobile();
    }

    onSpaceClick(space: Space) {
        this.tabService.updateActiveTabRoute(`./spaces/${space.id}`, space.name, 'bi bi-folder');
        this.sidebarService.closeMobile();
    }

    // ── Space creation ──

    startCreating() {
        // If sidebar is collapsed, expand it first to reveal the input
        if (this.isCollapsed()) {
            this.sidebarService.toggleCollapsed();
        }
        this.isCreating.set(true);
        this.newSpaceName.set('');
        this.inputError.set(null);
        setTimeout(() => this.spaceInputRef?.nativeElement?.focus(), 150);
    }

    cancelCreating() {
        this.isCreating.set(false);
        this.newSpaceName.set('');
        this.inputError.set(null);
    }

    onSpaceInput(value: string) {
        this.newSpaceName.set(value);
        const error = this.spaceService.validateName(value);
        this.inputError.set(error);
    }

    async confirmCreate() {
        if (this.inputError()) return; // Don't submit with validation error
        const workspace = this.activeWorkspace();
        if (!workspace) return;

        const raw = this.newSpaceName().trim();
        await this.spaceService.create(workspace.id, workspace.name, raw || undefined);
        this.isCreating.set(false);
        this.newSpaceName.set('');
        this.inputError.set(null);
    }

    onSpaceInputKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.confirmCreate();
        } else if (event.key === 'Escape') {
            this.cancelCreating();
        }
    }

    // ── Context menu ──

    toggleMenu(spaceId: string, event: Event) {
        event.stopPropagation();
        this.openMenuId.set(this.openMenuId() === spaceId ? null : spaceId);
    }

    async deleteSpace(spaceId: string, event: Event) {
        event.stopPropagation();
        this.openMenuId.set(null);

        const workspace = this.activeWorkspace();
        if (!workspace) return;

        await this.spaceService.delete(spaceId, workspace.name);
    }
}
