import { Injectable, inject, signal, computed } from '@angular/core';
import { AuthService } from '../../auth/auth.service';
import { SpaceService } from '../components/space.service';
import { FileManagerService } from '../components/file-manager.service';
import { Workspace } from '../../interfaces/workspace';
import { Space } from '../../interfaces/space';
import { FileSystemService } from '../data/file-system.service';
import { Router } from '@angular/router';
import { WorkspaceService } from '../components/workspace.service';

export interface TerminalLine {
    text: string;
    type: 'command' | 'output' | 'error' | 'system';
    isHtml?: boolean;
}

const HISTORY_BUFFER_LIMIT = 500;

export interface TerminalInstance {
    id: string;
    label: string;
    historyLines: TerminalLine[];
    currentWorkspace: Workspace | null;
    currentSpace: Space | null;
    isAtGlobalRoot: boolean;
    localHistory: string[];
    historyIndex: number;
    currentInput: string;
}

export type TerminalTab = 'terminal' | 'source-control' | 'output' | 'problems';

@Injectable({ providedIn: 'root' })
export class TerminalService {
    private auth = inject(AuthService);
    private spaces = inject(SpaceService);
    private fileManager = inject(FileManagerService);
    private fileSystem = inject(FileSystemService);
    private workspaceService = inject(WorkspaceService);
    private router = inject(Router);

    isOpen = signal<boolean>(false);
    activeTab = signal<TerminalTab>('terminal');
    isMaximized = signal<boolean>(false);

    // ── Multi-Instance State ──
    instances = signal<TerminalInstance[]>([]);
    activeInstanceId = signal<string>('');

    // Computed: active instance (convenience accessor)
    activeInstance = computed<TerminalInstance | null>(() => {
        const id = this.activeInstanceId();
        return this.instances().find(i => i.id === id) ?? null;
    });

    // ── Backward-compatible accessors ──
    // These delegate to the active instance so existing template bindings still work
    historyLines = computed<TerminalLine[]>(() => this.activeInstance()?.historyLines ?? []);

    private instanceCounter = 0;

    constructor() {
        // Boot with one initial instance
        this.createInstance();
    }

    // ── Instance Management ──

    createInstance(): TerminalInstance {
        this.instanceCounter++;
        const inst: TerminalInstance = {
            id: crypto.randomUUID(),
            label: `quilix ${this.instanceCounter}`,
            historyLines: [],
            currentWorkspace: null,
            currentSpace: null,
            isAtGlobalRoot: false,
            localHistory: [],
            historyIndex: -1,
            currentInput: '',
        };

        // Print welcome only on the first instance
        if (this.instanceCounter === 1) {
            inst.historyLines.push(
                { text: 'Quilix Virtual Shell (Angular Native) initialized.', type: 'system' },
                { text: 'Type "help" to see available commands.', type: 'system' }
            );
        } else {
            inst.historyLines.push(
                { text: `Terminal session "${inst.label}" started.`, type: 'system' }
            );
        }

        this.instances.update(arr => [...arr, inst]);
        this.activeInstanceId.set(inst.id);
        return inst;
    }

    removeInstance(id: string) {
        const current = this.instances();
        if (current.length <= 1) return; // Cannot close last instance

        this.instances.update(arr => arr.filter(i => i.id !== id));

        // If the removed instance was active, switch to the last remaining one
        if (this.activeInstanceId() === id) {
            const remaining = this.instances();
            this.activeInstanceId.set(remaining[remaining.length - 1].id);
        }
    }

    setActiveInstance(id: string) {
        if (this.instances().find(i => i.id === id)) {
            this.activeInstanceId.set(id);
        }
    }

    // ── Helper to mutate the active instance immutably via signal ──

    private updateActiveInstance(fn: (inst: TerminalInstance) => TerminalInstance) {
        const id = this.activeInstanceId();
        this.instances.update(arr =>
            arr.map(i => i.id === id ? fn({ ...i }) : i)
        );
    }

    // ── Public API (delegates to active instance) ──

    toggle() {
        this.isOpen.set(!this.isOpen());
        if (this.isOpen()) {
            this.refreshContext();
        }
    }

    async refreshContext() {
        const ws = await this.auth.getCurrentWorkspace();
        const inst = this.activeInstance();
        if (!inst) return;

        this.updateActiveInstance(i => {
            i.currentWorkspace = ws || null;
            if (!ws) {
                i.currentSpace = null;
            } else if (i.currentSpace && i.currentSpace.workspaceId !== ws.id) {
                i.currentSpace = null;
            }
            return i;
        });
    }

    getPromptString(): string {
        const inst = this.activeInstance();
        if (!inst) return 'quilix> ';
        const ws = inst.currentWorkspace;
        const sp = inst.currentSpace;
        if (inst.isAtGlobalRoot) return 'quilix> ';
        if (!ws) return 'quilix> ';
        if (!sp) return `quilix/${ws.name.toLowerCase()}> `;
        return `quilix/${ws.name.toLowerCase()}/${sp.name.toLowerCase()}> `;
    }

    // ── Print helpers (always target active instance) ──

    printError(text: string) {
        this.updateActiveInstance(i => {
            const newLines: TerminalLine[] = [...i.historyLines, { text, type: 'error' }];
            i.historyLines = newLines.slice(-HISTORY_BUFFER_LIMIT);
            return i;
        });
    }

    printSystem(text: string) {
        this.updateActiveInstance(i => {
            const newLines: TerminalLine[] = [...i.historyLines, { text, type: 'system' }];
            i.historyLines = newLines.slice(-HISTORY_BUFFER_LIMIT);
            return i;
        });
    }

    printOutput(text: string, isHtml = false) {
        this.updateActiveInstance(i => {
            const newLines: TerminalLine[] = [...i.historyLines, { text, type: 'output', isHtml }];
            i.historyLines = newLines.slice(-HISTORY_BUFFER_LIMIT);
            return i;
        });
    }

    clear() {
        this.updateActiveInstance(i => {
            i.historyLines = [];
            return i;
        });
    }

    // ── Context accessors for active instance ──

    private getCurrentWorkspace(): Workspace | null {
        return this.activeInstance()?.currentWorkspace ?? null;
    }

    private getCurrentSpace(): Space | null {
        return this.activeInstance()?.currentSpace ?? null;
    }

    private getIsAtGlobalRoot(): boolean {
        return this.activeInstance()?.isAtGlobalRoot ?? false;
    }

    private setCurrentSpace(sp: Space | null) {
        this.updateActiveInstance(i => { i.currentSpace = sp; return i; });
    }

    private setIsAtGlobalRoot(val: boolean) {
        this.updateActiveInstance(i => { i.isAtGlobalRoot = val; return i; });
    }

    private setCurrentWorkspace(ws: Workspace | null) {
        this.updateActiveInstance(i => { i.currentWorkspace = ws; return i; });
    }

    // ── Command Execution ──

    async execute(command: string) {
        const raw = command.trim();
        if (!raw) return;

        // Print command verbatim
        this.updateActiveInstance(i => {
            const newLines: TerminalLine[] = [...i.historyLines, { text: `${this.getPromptString()}${raw}`, type: 'command' }];
            i.historyLines = newLines.slice(-HISTORY_BUFFER_LIMIT);
            return i;
        });

        const args = raw.split(/\s+/);
        const cmd = args[0].toLowerCase();
        const targetRaw = raw.substring(cmd.length).trim();
        
        await this.refreshContext();

        try {
            switch(cmd) {
                case 'help':
                    this.printOutput(
                        'Available commands:<br/>' +
                        '- <b>pwd</b>: Print current path<br/>' +
                        '- <b>ls</b>: List directories/files<br/>' +
                        '- <b>cd &lt;target&gt;</b>: Navigate to space or root (..)<br/>' +
                        '- <b>mkdir &lt;name&gt;</b>: Create new space/folder<br/>' +
                        '- <b>rn &quot;old&quot; to &quot;new&quot;</b>: Rename space/folder<br/>' +
                        '- <b>rm &lt;name&gt;</b>: Delete space/folder<br/>' +
                        '- <b>find &lt;query&gt;</b>: Recursive search within focus<br/>' +
                        '- <b>sync</b>: Force physical disk resync<br/>' +
                        '- <b>clear</b>: Clear terminal display<br/>' +
                        '<br/><span class="text-secondary"> Info: Add <b>-ws</b> flag to commands to target workspaces globally (e.g. <b>cd -ws Alpha</b> or <b>rm -ws Name</b>).</span>', 
                        true
                    );
                    break;
                case 'clear':
                    this.clear();
                    break;
                case 'sync':
                    this.printSystem('Running disk reconciliation...');
                    try {
                        await this.workspaceService.syncExternalRenames();
                        this.printOutput('Storage perfectly synced with physical disk.');
                    } catch (e) {
                         this.printError('Sync failed.');
                    }
                    break;
                case 'pwd':
                    this.printOutput(this.getPromptString().replace('> ', ''));
                    break;
                case 'ls':
                case 'dir':
                    await this.runLs();
                    break;
                case 'cd':
                    await this.runCd(targetRaw);
                    break;
                case 'mkdir':
                case 'touch':
                    await this.runMkdir(targetRaw);
                    break;
                case 'rm':
                    await this.runRm(targetRaw);
                    break;
                case 'rn':
                case 'rename':
                    await this.runRename(raw);
                    break;
                case 'find':
                case 'search':
                    await this.runFind(targetRaw);
                    break;
                default:
                    this.printError(`Command not found: ${cmd}`);
            }
        } catch (e: any) {
            this.printError(`Error: ${e.message}`);
        }
    }

    private async runLs() {
        if (this.getIsAtGlobalRoot()) {
            const workspaces = await this.workspaceService.getAll();
            if (workspaces.length === 0) {
                this.printOutput('No workspaces found.');
                return;
            }
            let out = '<div class="ls-grid">';
            for (const w of workspaces) {
                const icon = w.role === 'team' ? 'bi-building text-primary' : 'bi-person-fill text-primary';
                out += `<span class="ls-item space"><i class="bi ${icon} me-2"></i>${w.name}</span>`;
            }
            out += '</div>';
            this.printOutput(out, true);
            return;
        }

        const ws = this.getCurrentWorkspace();
        if (!ws) {
            this.printError('No active workspace. Try "cd .." to view workspaces.');
            return;
        }

        const sp = this.getCurrentSpace();
        if (!sp) {
            // At workspace root, list spaces
            const spaces = await this.spaces.getByWorkspace(ws.id);
            if (spaces.length === 0) {
                this.printOutput('No spaces found.');
                return;
            }
            let out = '<div class="ls-grid">';
            for (const s of spaces) {
                out += `<span class="ls-item space me-2 text-primary"><i class="bi bi-folder-fill me-2 text-warning"></i>${s.name}/</span>`;
            }
            out += '</div>';
            this.printOutput(out, true);
        } else {
            // Inside a Space, list its root
            const mode = await this.fileSystem.getStorageMode();
            let handle: any = undefined;
            if (mode === 'filesystem') {
                handle = await this.fileSystem.resolveSpaceHandle(ws.name, sp.id);
            }
            const entries = await this.fileManager.readDirectory({ handle, spaceId: sp.id, parentId: sp.id });
            if (entries.length === 0) {
                this.printOutput('Directory is empty.');
                return;
            }
            let out = '<div class="ls-grid">';
            for (const e of entries) {
                const icon = e.kind === 'directory' ? 'bi-folder2 text-warning' : 'bi-file-earmark text-info';
                out += `<span class="ls-item me-2"><i class="bi ${icon} me-2"></i>${e.name}</span>`;
            }
            out += '</div>';
            this.printOutput(out, true);
        }
    }

    private async runCd(target: string) {
        if (!target) {
            this.setCurrentSpace(null);
            this.setIsAtGlobalRoot(false);
            return;
        }

        // Feature: Workspace Cross-jumping
        if (target.startsWith('-ws ')) {
            const wsTarget = target.substring(4).trim();
            const workspaces = await this.workspaceService.getAll();
            const match = workspaces.find(w => w.name.toLowerCase() === wsTarget.toLowerCase());
            
            if (match) {
                if (this.getCurrentWorkspace()?.id === match.id) {
                    this.printSystem(`Already in workspace: ${match.name}`);
                    return;
                }
                this.printSystem(`Switching to workspace: ${match.name}...`);
                await this.auth.loginExisting(match);
                localStorage.setItem('quilix_entry_type', 'return');
                localStorage.setItem('quilix_entry_name', match.name);
                this.router.navigate([match.role === 'personal' ? '/personal' : '/team']).then(() => {
                    this.setIsAtGlobalRoot(false);
                    this.refreshContext();
                });
            } else {
                this.printError(`Workspace not found: ${wsTarget}`);
            }
            return;
        }

        if (target === '..') {
            if (this.getCurrentSpace()) {
                this.setCurrentSpace(null); // Go to Workspace root
            } else {
                this.setIsAtGlobalRoot(true); // Go to Global root
            }
            return;
        }

        if (this.getIsAtGlobalRoot()) {
            const workspaces = await this.workspaceService.getAll();
            const match = workspaces.find(w => w.name.toLowerCase() === target.toLowerCase());
            if (match) {
                this.printSystem(`Switching to workspace: ${match.name}...`);
                await this.auth.loginExisting(match);
                localStorage.setItem('quilix_entry_type', 'return');
                localStorage.setItem('quilix_entry_name', match.name);
                this.router.navigate([match.role === 'personal' ? '/personal' : '/team']).then(() => {
                    this.setIsAtGlobalRoot(false);
                    this.refreshContext();
                });
            } else {
                this.printError(`Workspace not found: ${target}`);
            }
            return;
        }

        const ws = this.getCurrentWorkspace();
        if (!ws) {
            this.printError('No active workspace.');
            return;
        }

        if (this.getCurrentSpace()) {
            this.printError('Deep directory navigation via shell is not fully implemented. Try "cd .." first.');
            return;
        }

        // Search for space by name
        const spaces = await this.spaces.getByWorkspace(ws.id);
        const match = spaces.find(s => s.name.toLowerCase() === target.toLowerCase());
        if (match) {
            this.setCurrentSpace(match);
        } else {
            this.printError(`Space not found: ${target}`);
        }
    }

    private async runMkdir(target: string) {
        if (!target) {
            this.printError('Missing directory name. Usage: mkdir <name>');
            return;
        }

        if (target.startsWith('-ws ')) {
            const name = target.substring(4).trim();
            this.printSystem(`Creating workspace: ${name}...`);
            const res = await this.auth.createWorkspace(name, 'personal');
            if (res.success) {
                this.printOutput(`Created workspace ${name} and switching...`);
                localStorage.setItem('quilix_entry_type', 'return');
                localStorage.setItem('quilix_entry_name', name);
                this.router.navigate(['/personal']).then(() => {
                    this.setIsAtGlobalRoot(false);
                    this.refreshContext();
                });
            } else {
                this.printError(`Failed to create space (maybe duplicate name).`);
            }
            return;
        }

        const ws = this.getCurrentWorkspace();
        if (!ws) {
            this.printError('No active workspace.');
            return;
        }

        if (!this.getCurrentSpace()) {
            // Create Space
            await this.spaces.create(ws.id, ws.name, target);
            this.printOutput(`Created space ${target}`);
        } else {
            this.printError('Creating nested directories via terminal is currently limited to Workspace Root.');
        }
    }

    private async runRm(target: string) {
        if (!target) {
            this.printError('Missing target. Usage: rm <name>');
            return;
        }

        if (target.startsWith('-ws ')) {
            const wsTarget = target.substring(4).trim();
            const workspaces = await this.workspaceService.getAll();
            const match = workspaces.find(w => w.name.toLowerCase() === wsTarget.toLowerCase());
            if (match) {
                this.printSystem(`Trashing workspace: ${match.name}...`);
                await this.auth.deleteWorkspace(match.id);
                this.printOutput(`Workspace deleted.`);
            } else {
                this.printError(`Workspace not found: ${wsTarget}`);
            }
            return;
        }

        const ws = this.getCurrentWorkspace();
        if (!ws) {
            this.printError('No active workspace.');
            return;
        }

        if (!this.getCurrentSpace()) {
            // Delete Space
            const spaces = await this.spaces.getByWorkspace(ws.id);
            const match = spaces.find(s => s.name.toLowerCase() === target.toLowerCase());
            if (match) {
                await this.spaces.moveToTrash(match.id, ws.name);
                this.printOutput(`Moved space ${target} to trash.`);
            } else {
                this.printError(`Space not found: ${target}`);
            }
        } else {
            // Delete file/folder inside space
            const sp = this.getCurrentSpace()!;
            const mode = await this.fileSystem.getStorageMode();
            let handle: any = undefined;
            if (mode === 'filesystem') {
                handle = await this.fileSystem.resolveSpaceHandle(ws.name, sp.id);
            }
            
            const entries = await this.fileManager.readDirectory({ handle, spaceId: sp.id, parentId: sp.id });
            const match = entries.find(e => e.name.toLowerCase() === target.toLowerCase());
            
            if (match) {
                await this.fileManager.deleteEntry({ parentHandle: handle }, match);
                this.printOutput(`Deleted ${match.kind}: ${target}`);
            } else {
                this.printError(`File or folder not found: ${target}`);
            }
        }
    }

    private async runFind(target: string) {
        if (!target) {
            this.printError('Missing query. Usage: find <query>');
            return;
        }
        
        const ws = this.getCurrentWorkspace();
        if (!ws) {
            this.printError('No active workspace required to search within.');
            return;
        }

        const sp = this.getCurrentSpace();
        if (!sp) {
            this.printError('Must be inside a Space to perform recursive searches.');
            return;
        }

        const mode = await this.fileSystem.getStorageMode();
        let handle: any = undefined;
        if (mode === 'filesystem') {
            handle = await this.fileSystem.resolveSpaceHandle(ws.name, sp.id);
        }

        this.printSystem(`Searching for "${target}"...`);
        const entries = await this.fileManager.searchEntries({ handle, spaceId: sp.id }, target);
        
        if (entries.length === 0) {
            this.printOutput('No matches found.');
            return;
        }

        let out = '<div class="ls-grid">';
        for (const e of entries) {
            const icon = e.kind === 'directory' ? 'bi-folder2 text-warning' : 'bi-file-earmark text-info';
            const breadcrumb = e.parentChain && e.parentChain.length ? e.parentChain.map(c => c.name).join('/') + '/' : '';
            out += `<span class="ls-item"><i class="bi ${icon} me-2"></i><span><b>${e.name}</b> <span style="opacity: 0.85; margin-left: 8px;">(${breadcrumb}${e.name})</span></span></span>`;
        }
        out += '</div>';
        this.printOutput(out, true);
    }

    private async runRename(raw: string) {
        // syntax: rn "old" to "new" or rn -ws "old" to "new"
        const match = raw.match(/^rn\s+(?:-ws\s+)?["'](.*?)["']\s+to\s+["'](.*?)["']/i) || 
                      raw.match(/^rename\s+(?:-ws\s+)?["'](.*?)["']\s+to\s+["'](.*?)["']/i);
                      
        if (!match) {
            this.printError('Invalid syntax. Usage: rn "old name" to "new name"');
            return;
        }

        const oldName = match[1];
        const newName = match[2];
        const isWs = raw.toLowerCase().includes('-ws ');

        if (isWs) {
            const workspaces = await this.workspaceService.getAll();
            const wsMatch = workspaces.find(w => w.name.toLowerCase() === oldName.toLowerCase());
            if (wsMatch) {
                // Workspace rename is robust and handles DB safely
                const success = await this.workspaceService.rename(wsMatch.id, newName);
                if (success) {
                    this.printOutput(`Renamed workspace "${oldName}" to "${newName}"`);
                } else {
                    this.printError(`Failed to rename workspace (perhaps name taken or disk locked).`);
                }
            } else {
                this.printError(`Workspace not found: ${oldName}`);
            }
            return;
        }

        const ws = this.getCurrentWorkspace();
        if (!ws) {
            this.printError('No active workspace.');
            return;
        }

        if (!this.getCurrentSpace()) {
            // Rename Space
            const spaces = await this.spaces.getByWorkspace(ws.id);
            const spMatch = spaces.find(s => s.name.toLowerCase() === oldName.toLowerCase());
            if (spMatch) {
                const updated = await this.spaces.rename(spMatch.id, newName, ws.name);
                if (updated) {
                    this.printOutput(`Renamed space "${oldName}" to "${newName}"`);
                } else {
                    this.printError(`Failed to rename space.`);
                }
            } else {
                this.printError(`Space not found: ${oldName}`);
            }
        } else {
            // Rename File/Folder inside Space
            const sp = this.getCurrentSpace()!;
            const mode = await this.fileSystem.getStorageMode();
            let handle: any = undefined;
            if (mode === 'filesystem') {
                handle = await this.fileSystem.resolveSpaceHandle(ws.name, sp.id);
            }
            
            const entries = await this.fileManager.readDirectory({ handle, spaceId: sp.id, parentId: sp.id });
            const eMatch = entries.find(e => e.name.toLowerCase() === oldName.toLowerCase());
            
            if (eMatch) {
                const success = await this.fileManager.renameEntry({ parentHandle: handle, spaceId: sp.id, parentId: sp.id }, eMatch, newName);
                if (success) {
                     this.printOutput(`Renamed "${oldName}" to "${newName}"`);
                } else {
                     this.printError(`Failed to rename (name exists or locked).`);
                }
            } else {
                this.printError(`File or folder not found: ${oldName}`);
            }
        }
    }
}
