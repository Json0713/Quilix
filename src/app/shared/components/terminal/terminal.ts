import { Component, ElementRef, ViewChild, inject, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TerminalService, TerminalTab } from '../../../core/services/ui/terminal.service';
import { SourceControl } from './source-control/source-control';

// export type TerminalTab = 'terminal' | 'source-control' | 'output' | 'problems'; // REMOVED

@Component({
    selector: 'app-terminal',
    standalone: true,
    imports: [CommonModule, FormsModule, SourceControl],
    templateUrl: './terminal.html',
    styleUrl: './terminal.scss',
})
export class TerminalComponent {
    terminal = inject(TerminalService);

    @ViewChild('cmdInput') cmdInput!: ElementRef<HTMLInputElement>;
    @ViewChild('scrollContainer') scrollContainer!: ElementRef<HTMLDivElement>;

    activeTab = this.terminal.activeTab;
    isMaximized = this.terminal.isMaximized;

    // Global toggle (Ctrl + ` or Ctrl + M)
    @HostListener('document:keydown', ['$event'])
    handleGlobalKeyboard(event: KeyboardEvent) {
        if ((event.ctrlKey || event.metaKey) && (event.key === '`' || event.key.toLowerCase() === 'm')) {
            event.preventDefault();
            this.terminal.toggle();
            
            // Auto-focus input when opened
            if (this.terminal.isOpen()) {
                setTimeout(() => this.focusInput(), 100);
            }
        }
    }

    setTab(tab: TerminalTab) {
        this.activeTab.set(tab);
        // Auto-focus terminal input when switching to terminal tab
        if (tab === 'terminal') {
            setTimeout(() => this.focusInput(), 50);
        }
    }

    // Get current input for the active instance
    get currentInput(): string {
        return this.terminal.activeInstance()?.currentInput ?? '';
    }

    set currentInput(value: string) {
        const inst = this.terminal.activeInstance();
        if (!inst) return;
        this.terminal.instances.update(arr =>
            arr.map(i => i.id === inst.id ? { ...i, currentInput: value } : i)
        );
    }

    async onKeydown(event: KeyboardEvent) {
        const inst = this.terminal.activeInstance();
        if (!inst) return;

        if (event.key === 'Enter') {
            event.preventDefault();
            const cmd = this.currentInput;
            if (cmd.trim()) {
                // Push to instance-local history
                this.terminal.instances.update(arr =>
                    arr.map(i => i.id === inst.id
                        ? { ...i, localHistory: [...i.localHistory, cmd], historyIndex: i.localHistory.length + 1 }
                        : i)
                );
            }
            this.currentInput = '';
            
            await this.terminal.execute(cmd);
            this.scrollToBottom();
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (inst.historyIndex > 0) {
                const newIndex = inst.historyIndex - 1;
                this.terminal.instances.update(arr =>
                    arr.map(i => i.id === inst.id
                        ? { ...i, historyIndex: newIndex, currentInput: i.localHistory[newIndex] }
                        : i)
                );
            }
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (inst.historyIndex < inst.localHistory.length - 1) {
                const newIndex = inst.historyIndex + 1;
                this.terminal.instances.update(arr =>
                    arr.map(i => i.id === inst.id
                        ? { ...i, historyIndex: newIndex, currentInput: i.localHistory[newIndex] }
                        : i)
                );
            } else {
                this.terminal.instances.update(arr =>
                    arr.map(i => i.id === inst.id
                        ? { ...i, historyIndex: i.localHistory.length, currentInput: '' }
                        : i)
                );
            }
        } else if (event.key === 'Escape') {
            event.preventDefault();
            this.terminal.toggle();
        }
    }

    focusInput() {
        if (this.activeTab() !== 'terminal') return;
        if (window.getSelection()?.toString().length) {
            return; // Allow users to highlight text without pulling focus away!
        }
        if (this.cmdInput) {
            this.cmdInput.nativeElement.focus();
        }
    }

    toggleMaximize() {
        this.isMaximized.update(v => !v);
    }

    private scrollToBottom() {
        setTimeout(() => {
            if (this.scrollContainer) {
                const el = this.scrollContainer.nativeElement;
                el.scrollTop = el.scrollHeight;
            }
        }, 50);
    }
}
