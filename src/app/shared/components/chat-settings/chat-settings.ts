import { Component, EventEmitter, Input, Output, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../../core/services/components/chat.service';
import { db } from '../../../core/database/dexie.service';

@Component({
    selector: 'app-chat-settings',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './chat-settings.html',
    styleUrl: './chat-settings.scss'
})
export class ChatSettingsComponent implements OnInit {
    private chat = inject(ChatService);

    @Input() visible = false;
    @Output() visibleChange = new EventEmitter<boolean>();

    activeTab: 'general' | 'personalization' | 'data' = 'general';

    // Settings
    generalMemory = '';
    isSavingMemory = false;

    // Theme mock
    theme: 'system' | 'light' | 'dark' = 'system';

    async ngOnInit() {
        // Load the general memory from Dexie
        const memorySetting = await db.settings.get('chat_general_memory');
        if (memorySetting) {
            this.generalMemory = memorySetting.value;
        }
    }

    close() {
        this.visible = false;
        this.visibleChange.emit(this.visible);
    }

    setTab(tab: 'general' | 'personalization' | 'data') {
        this.activeTab = tab;
    }

    async saveMemory() {
        this.isSavingMemory = true;
        await db.settings.put({ key: 'chat_general_memory', value: this.generalMemory.trim() });
        setTimeout(() => {
            this.isSavingMemory = false;
        }, 800);
    }

    async clearAllChats() {
        const confirmDelete = confirm('Are you sure you want to clear all chat history for this workspace? This cannot be undone.');
        if (confirmDelete) {
            await this.chat.clearAllChats();
            this.close();
        }
    }
}
