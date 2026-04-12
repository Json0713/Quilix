import { Injectable, inject, signal } from '@angular/core';
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

@Injectable({ providedIn: 'root' })
export class TerminalService {
    private auth = inject(AuthService);
    private spaces = inject(SpaceService);
    private fileManager = inject(FileManagerService);
    private fileSystem = inject(FileSystemService);
    private workspaceService = inject(WorkspaceService);
    private router = inject(Router);

    isOpen = signal<boolean>(false);
    historyLines = signal<TerminalLine[]>([]);
    
    currentWorkspace = signal<Workspace | null>(null);
    currentSpace = signal<Space | null>(null);
    isAtGlobalRoot = signal<boolean>(false);

    constructor() {
        this.printSystem('Quilix Virtual Shell (Angular Native) initialized.');
        this.printSystem('Type "help" to see available commands.');
    }

    toggle() {
        this.isOpen.set(!this.isOpen());
        if (this.isOpen()) {
            this.refreshContext();
        }
    }

    async refreshContext() {
        const ws = await this.auth.getCurrentWorkspace();
        this.currentWorkspace.set(ws || null);
        if (!ws) {
            this.currentSpace.set(null);
        } else if (this.currentSpace() && this.currentSpace()?.workspaceId !== ws.id) {
            this.currentSpace.set(null);
        }
    }

    getPromptString(): string {
        const ws = this.currentWorkspace();
        const sp = this.currentSpace();
        if (this.isAtGlobalRoot()) return 'quilix> ';
        if (!ws) return 'quilix> ';
        if (!sp) return `quilix/${ws.name.toLowerCase()}> `;
        return `quilix/${ws.name.toLowerCase()}/${sp.name.toLowerCase()}> `;
    }

    printError(text: string) {
        this.historyLines.update(l => [...l, { text, type: 'error' }]);
    }

    printSystem(text: string) {
        this.historyLines.update(l => [...l, { text, type: 'system' }]);
    }

    printOutput(text: string, isHtml = false) {
        this.historyLines.update(l => [...l, { text, type: 'output', isHtml }]);
    }

    clear() {
        this.historyLines.set([]);
    }

    async execute(command: string) {
        const raw = command.trim();
        if (!raw) return;

        // Print command verbatim
        this.historyLines.update(l => [...l, { text: `${this.getPromptString()}${raw}`, type: 'command' }]);

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
                        '<br/><span style="color: rgba(179, 136, 255, 0.85);">Note: Add <b>-ws</b> flag to commands to target workspaces globally (e.g. <b>cd -ws Alpha</b> or <b>rm -ws Name</b>).</span>', 
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
        if (this.isAtGlobalRoot()) {
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

        const ws = this.currentWorkspace();
        if (!ws) {
            this.printError('No active workspace. Try "cd .." to view workspaces.');
            return;
        }

        const sp = this.currentSpace();
        if (!sp) {
            // At workspace root, list spaces
            const spaces = await this.spaces.getByWorkspace(ws.id);
            if (spaces.length === 0) {
                this.printOutput('No spaces found.');
                return;
            }
            let out = '<div class="ls-grid">';
            for (const s of spaces) {
                out += `<span class="ls-item space"><i class="bi bi-folder-fill me-2 text-primary"></i>${s.name}</span>`;
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
                const icon = e.kind === 'directory' ? 'bi-folder2 text-primary' : 'bi-file-earmark text-secondary';
                out += `<span class="ls-item"><i class="bi ${icon} me-2"></i>${e.name}</span>`;
            }
            out += '</div>';
            this.printOutput(out, true);
        }
    }

    private async runCd(target: string) {
        if (!target) {
            this.currentSpace.set(null);
            this.isAtGlobalRoot.set(false);
            return;
        }

        // Feature: Workspace Cross-jumping
        if (target.startsWith('-ws ')) {
            const wsTarget = target.substring(4).trim();
            const workspaces = await this.workspaceService.getAll();
            const match = workspaces.find(w => w.name.toLowerCase() === wsTarget.toLowerCase());
            
            if (match) {
                if (this.currentWorkspace()?.id === match.id) {
                    this.printSystem(`Already in workspace: ${match.name}`);
                    return;
                }
                this.printSystem(`Switching to workspace: ${match.name}...`);
                await this.auth.loginExisting(match);
                localStorage.setItem('quilix_entry_type', 'return');
                localStorage.setItem('quilix_entry_name', match.name);
                this.router.navigate([match.role === 'personal' ? '/personal' : '/team']).then(() => {
                    this.isAtGlobalRoot.set(false);
                    this.refreshContext();
                });
            } else {
                this.printError(`Workspace not found: ${wsTarget}`);
            }
            return;
        }

        if (target === '..') {
            if (this.currentSpace()) {
                this.currentSpace.set(null); // Go to Workspace root
            } else {
                this.isAtGlobalRoot.set(true); // Go to Global root
            }
            return;
        }

        if (this.isAtGlobalRoot()) {
            const workspaces = await this.workspaceService.getAll();
            const match = workspaces.find(w => w.name.toLowerCase() === target.toLowerCase());
            if (match) {
                this.printSystem(`Switching to workspace: ${match.name}...`);
                await this.auth.loginExisting(match);
                localStorage.setItem('quilix_entry_type', 'return');
                localStorage.setItem('quilix_entry_name', match.name);
                this.router.navigate([match.role === 'personal' ? '/personal' : '/team']).then(() => {
                    this.isAtGlobalRoot.set(false);
                    this.refreshContext();
                });
            } else {
                this.printError(`Workspace not found: ${target}`);
            }
            return;
        }

        const ws = this.currentWorkspace();
        if (!ws) {
            this.printError('No active workspace.');
            return;
        }

        if (this.currentSpace()) {
            this.printError('Deep directory navigation via shell is not fully implemented. Try "cd .." first.');
            return;
        }

        // Search for space by name
        const spaces = await this.spaces.getByWorkspace(ws.id);
        const match = spaces.find(s => s.name.toLowerCase() === target.toLowerCase());
        if (match) {
            this.currentSpace.set(match);
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
                    this.isAtGlobalRoot.set(false);
                    this.refreshContext();
                });
            } else {
                this.printError(`Failed to create space (maybe duplicate name).`);
            }
            return;
        }

        const ws = this.currentWorkspace();
        if (!ws) {
            this.printError('No active workspace.');
            return;
        }

        if (!this.currentSpace()) {
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

        const ws = this.currentWorkspace();
        if (!ws) {
            this.printError('No active workspace.');
            return;
        }

        if (!this.currentSpace()) {
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
            const sp = this.currentSpace()!;
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
        
        const ws = this.currentWorkspace();
        if (!ws) {
            this.printError('No active workspace required to search within.');
            return;
        }

        const sp = this.currentSpace();
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
            const icon = e.kind === 'directory' ? 'bi-folder2 text-primary' : 'bi-file-earmark text-secondary';
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

        const ws = this.currentWorkspace();
        if (!ws) {
            this.printError('No active workspace.');
            return;
        }

        if (!this.currentSpace()) {
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
            const sp = this.currentSpace()!;
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
