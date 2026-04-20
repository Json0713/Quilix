import { Component, inject, signal, OnInit, OnDestroy, ElementRef, ViewChild, ViewChildren, QueryList, HostListener } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { SidebarService } from '../../../../../services/ui/common/sidebar/sidebar.service';
import { AuthService } from '../../../../../core/auth/auth.service';
import { SpaceService } from '../../../../../core/services/components/space.service';
import { TabService } from '../../../../../core/services/ui/tab.service';
import { Space } from '../../../../../core/interfaces/space';
import { Workspace } from '../../../../../core/interfaces/workspace';
import { WorkspaceService } from '../../../../../core/services/components/workspace.service';
import { SettingsKitComponent } from '../settings-kit/settings-kit';
import { TeamProfileMenuComponent } from '../profile-menu/profile-menu';
import { DropdownService } from '../../../../../services/ui/common/dropdown/dropdown.service';

@Component({
    selector: 'app-team-sidebar',
    standalone: true,
    imports: [RouterLink, RouterLinkActive, CommonModule, FormsModule, DragDropModule, SettingsKitComponent, TeamProfileMenuComponent],
    templateUrl: './sidebar.html',
    styleUrl: './sidebar.scss',
})
export class TeamSidebarComponent implements OnInit, OnDestroy {
    private sidebarService = inject(SidebarService);
    private authService = inject(AuthService);
    private spaceService = inject(SpaceService);
    private workspaceService = inject(WorkspaceService);
    private tabService = inject(TabService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    public dropdownService = inject(DropdownService);

    isCollapsed = this.sidebarService.isCollapsed;
    isMobileOpen = this.sidebarService.isMobileOpen;

    navItems = [
        { label: 'Home', icon: 'bi bi-house', route: './' },
        { label: 'Workspaces', icon: 'bi bi-archive', route: './workspaces' },
        { label: 'Ask Quilix', icon: 'bi bi-chat-dots', route: './chat' },
    ];

    // ── Spaces state ──
    activeWorkspace = signal<Workspace | null>(null);
    spaces = signal<Space[]>([]);
    isCreating = signal<boolean>(false);
    newSpaceName = signal<string>('');
    inputError = signal<string | null>(null);
    hasMissingWorkspaces = signal<boolean>(false);
    private isSubmitting = false;

    // ── Loading state access ──
    isSyncing = this.spaceService.isSyncing;
    activeOperations = this.spaceService.activeOperations;

    isSpaceLoading(spaceId: string): boolean {
        return this.activeOperations().has(spaceId);
    }

    // ── Context menu state ──
    openMenuId = signal<string | null>(null);

    // ── Rename state ──
    renamingSpaceId = signal<string | null>(null);
    renameValue = signal<string>('');
    renameError = signal<string | null>(null);

    @ViewChild('spaceInput') spaceInputRef!: ElementRef<HTMLInputElement>;
    @ViewChildren('renameInput') renameInputRefs!: QueryList<ElementRef<HTMLInputElement>>;

    private spaceSub: any;
    private workspaceSub: any;
    private authSub: any;

    async ngOnInit() {
        await this.loadWorkspace();

        this.workspaceSub = this.workspaceService.workspaces$.subscribe(ws => {
            this.hasMissingWorkspaces.set(ws.some(w => w.isMissingOnDisk && w.role === 'team'));
            
            // Keep activeWorkspace reactive to disk renames from other components
            const currentActive = this.activeWorkspace();
            if (currentActive) {
                const refreshed = ws.find(w => w.id === currentActive.id);
                if (refreshed && refreshed.name !== currentActive.name) {
                    this.activeWorkspace.set(refreshed);
                }
            }
        });

        this.authSub = this.authService.authEvents$.subscribe(async (event) => {
            if (event === 'LOGIN') {
                await this.loadWorkspace();
            }
        });
    }

    private async loadWorkspace() {
        const workspace = await this.authService.getCurrentWorkspace();
        if (workspace) {
            this.activeWorkspace.set(workspace);
            this.spaceSub?.unsubscribe();
            this.spaceSub = this.spaceService.liveSpaces$(workspace.id).subscribe(
                (list: Space[]) => this.spaces.set(list)
            );
        }
    }

    ngOnDestroy() {
        this.spaceSub?.unsubscribe();
        this.workspaceSub?.unsubscribe();
        this.authSub?.unsubscribe();
    }

    @HostListener('document:click')
    onDocumentClick() {
        if (this.openMenuId()) {
            this.openMenuId.set(null);
            this.dropdownService.reset();
        }
    }

    // Close rename on outside click (if not clicking the rename input)
    @HostListener('document:mousedown', ['$event'])
    onDocumentMousedown(event: MouseEvent) {
        if (!this.renamingSpaceId()) return;
        const target = event.target as HTMLElement;
        if (!target.closest('.space-rename-inline')) {
            this.confirmRename();
        }
    }

    // Refresh Spaces when returning to the app window
    @HostListener('window:focus')
    async onWindowFocus() {
        const workspace = this.activeWorkspace();
        if (workspace) {
            await this.spaceService.syncExternalRenames(workspace.id, workspace.name);
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
        this.tabService.updateActiveTabRoute(item.route, item.label, item.icon);
        this.sidebarService.closeMobile();
    }

    onSpaceClick(space: Space) {
        this.tabService.updateActiveTabRoute(`./spaces/${space.id}`, space.name, 'bi bi-folder');
        this.sidebarService.closeMobile();
    }

    // ── Space Ordering & Tear-off ──
    async onSpaceDrop(event: CdkDragDrop<Space[]>) {
        const currentSpaces = [...this.spaces()];

        // Tear-off Logic: If the user dragged a Space outside the sidebar constraints
        if (!event.isPointerOverContainer) {
            const spaceToTear = currentSpaces[event.previousIndex];

            // Generate secure explicit 1-time token mapping isolated window handoff parameters
            const tearOffId = crypto.randomUUID();
            const spaceRoute = `./spaces/${spaceToTear.id}`;

            // We do not have history since the space isn't an active tab currently.
            // We just pass the target constraints exactly like how we render sidebar native clicks.
            const transferData = {
                tabState: { route: spaceRoute, label: spaceToTear.name, icon: 'bi bi-folder' },
                historyPayload: '' // Empty stack for a fresh window
            };

            // Write payload natively
            localStorage.setItem(`quilix_tearoff_${tearOffId}`, JSON.stringify(transferData));

            // Construct strictly isolated absolute URL payloads
            const targetUrl = this.router.createUrlTree([spaceRoute], {
                relativeTo: this.route,
                queryParams: { tearOffId }
            }).toString();

            // Fire separate physical popup identical to OS bounds
            window.open(targetUrl, '_blank', 'popup,width=1024,height=768');
            return;
        }

        // Internal Reordering Logic
        if (event.previousIndex !== event.currentIndex) {
            // Natively mutate array sorting mathematically inside the local Signal
            moveItemInArray(currentSpaces, event.previousIndex, event.currentIndex);
            // Optimistically update the UI so there's no layout jitter!
            this.spaces.set(currentSpaces);

            // Sync permanent state
            await this.spaceService.updateSpaceOrders(currentSpaces);
        }
    }

    // ── Space creation ──

    startCreating() {
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
        if (this.isSubmitting) return;
        if (this.inputError()) return;
        const workspace = this.activeWorkspace();
        if (!workspace) return;

        this.isSubmitting = true;
        try {
            const raw = this.newSpaceName().trim();
            await this.spaceService.create(workspace.id, workspace.name, raw || undefined);
            this.isCreating.set(false);
            this.newSpaceName.set('');
            this.inputError.set(null);
        } finally {
            this.isSubmitting = false;
        }
    }

    onSpaceInputKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            event.preventDefault();
            const input = event.target as HTMLInputElement;
            input.blur();
            this.confirmCreate();
        } else if (event.key === 'Escape') {
            this.cancelCreating();
        }
    }

    // ── Context menu ──

    toggleMenu(spaceId: string, event: Event) {
        event.stopPropagation();
        const isOpening = this.openMenuId() !== spaceId;
        this.openMenuId.set(isOpening ? spaceId : null);

        if (isOpening) {
            this.dropdownService.updatePosition(event);
        } else {
            this.dropdownService.reset();
        }
    }

    async trashSpace(spaceId: string, event: Event) {
        event.stopPropagation();
        this.openMenuId.set(null);

        const workspace = this.activeWorkspace();
        if (!workspace) return;

        await this.spaceService.moveToTrash(spaceId, workspace.name);
    }

    async restoreSpace(spaceId: string, event: Event) {
        event.stopPropagation();
        this.openMenuId.set(null);

        const workspace = this.activeWorkspace();
        if (!workspace) return;

        await this.spaceService.restoreSpace(spaceId, workspace.name);
    }

    // ── Rename ──

    startRename(space: Space, event: Event) {
        event.stopPropagation();
        this.openMenuId.set(null);
        this.renamingSpaceId.set(space.id);
        this.renameValue.set(space.name);
        this.renameError.set(null);
        setTimeout(() => {
            const input = this.renameInputRefs?.first?.nativeElement;
            if (input) {
                input.focus();
                input.select();
            }
        }, 50);
    }

    onRenameInput(value: string) {
        this.renameValue.set(value);
        const error = this.spaceService.validateName(value);
        this.renameError.set(error);
    }

    async confirmRename() {
        const spaceId = this.renamingSpaceId();
        if (!spaceId) return;
        if (this.renameError()) { this.cancelRename(); return; }

        const workspace = this.activeWorkspace();
        if (!workspace) return;

        const raw = this.renameValue().trim();
        
        // Eagerly clear the local renaming state to prevent duplicate inputs/clicks
        // from re-triggering this function while the first one is running.
        this.renamingSpaceId.set(null);
        this.renameValue.set('');
        this.renameError.set(null);

        if (raw) {
            await this.spaceService.rename(spaceId, raw, workspace.name);
            await this.tabService.updateTabLabelBySpaceId(spaceId, raw);
        }
    }

    cancelRename() {
        this.renamingSpaceId.set(null);
        this.renameValue.set('');
        this.renameError.set(null);
    }

    onRenameKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.confirmRename();
        } else if (event.key === 'Escape') {
            this.cancelRename();
        }
    }
}
