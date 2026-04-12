import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from '../../auth/auth.service';
import { SpaceService } from '../components/space.service';
import { FileManagerService } from '../components/file-manager.service';
import { Workspace } from '../../interfaces/workspace';
import { Space } from '../../interfaces/space';
import { FileSystemService } from '../data/file-system.service';

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

    isOpen = signal<boolean>(false);
    historyLines = signal<TerminalLine[]>([]);
    
    currentWorkspace = signal<Workspace | null>(null);
    currentSpace = signal<Space | null>(null);

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
        await this.refreshContext();

        try {
            switch(cmd) {
                case 'help':
                    this.printOutput('Available commands: <br/>- <b>pwd</b>: Print current path<br/>- <b>ls</b>: List directories/files<br/>- <b>cd</b> &lt;name&gt;: Navigate into space or root (cd ..)<br/>- <b>mkdir</b> &lt;name&gt;: Create a space (if at root) or directory<br/>- <b>rm</b> &lt;name&gt;: Delete a space or file<br/>- <b>clear</b>: Clear terminal display', true);
                    break;
                case 'clear':
                    this.clear();
                    break;
                case 'pwd':
                    this.printOutput(this.getPromptString().replace('> ', ''));
                    break;
                case 'ls':
                case 'dir':
                    await this.runLs();
                    break;
                case 'cd':
                    await this.runCd(args[1]);
                    break;
                case 'mkdir':
                case 'touch':
                    await this.runMkdir(args[1]);
                    break;
                case 'rm':
                    await this.runRm(args[1]);
                    break;
                default:
                    this.printError(`Command not found: ${cmd}`);
            }
        } catch (e: any) {
            this.printError(`Error: ${e.message}`);
        }
    }

    private async runLs() {
        const ws = this.currentWorkspace();
        if (!ws) {
            this.printError('No active workspace.');
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
            return;
        }
        if (target === '..') {
            this.currentSpace.set(null);
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
            this.printError('Deleting nested files via terminal is currently limited to Workspace Root.');
        }
    }
}
