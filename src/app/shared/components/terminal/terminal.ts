import { Component, ElementRef, ViewChild, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TerminalService } from '../../../core/services/ui/terminal.service';

@Component({
    selector: 'app-terminal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './terminal.html',
    styleUrl: './terminal.scss',
})
export class TerminalComponent {
    terminal = inject(TerminalService);

    @ViewChild('cmdInput') cmdInput!: ElementRef<HTMLInputElement>;
    @ViewChild('scrollContainer') scrollContainer!: ElementRef<HTMLDivElement>;

    currentInput = '';
    
    // Simple local history buffer for arrows
    localHistory: string[] = [];
    historyIndex = -1;

    // Global toggle (Ctrl + ` or Ctrl + J)
    @HostListener('document:keydown', ['$event'])
    handleGlobalKeyboard(event: KeyboardEvent) {
        if ((event.ctrlKey || event.metaKey) && (event.key === '`' || event.key === 'j')) {
            event.preventDefault();
            this.terminal.toggle();
            
            // Auto-focus input when opened
            if (this.terminal.isOpen()) {
                setTimeout(() => this.focusInput(), 100);
            }
        }
    }

    async onKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            event.preventDefault();
            const cmd = this.currentInput;
            if (cmd.trim()) {
                this.localHistory.push(cmd);
            }
            this.historyIndex = this.localHistory.length;
            this.currentInput = '';
            
            await this.terminal.execute(cmd);
            this.scrollToBottom();
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (this.historyIndex > 0) {
                this.historyIndex--;
                this.currentInput = this.localHistory[this.historyIndex];
            }
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (this.historyIndex < this.localHistory.length - 1) {
                this.historyIndex++;
                this.currentInput = this.localHistory[this.historyIndex];
            } else {
                this.historyIndex = this.localHistory.length;
                this.currentInput = '';
            }
        } else if (event.key === 'Escape') {
            event.preventDefault();
            this.terminal.toggle();
        }
    }

    focusInput() {
        if (this.cmdInput) {
            this.cmdInput.nativeElement.focus();
        }
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
