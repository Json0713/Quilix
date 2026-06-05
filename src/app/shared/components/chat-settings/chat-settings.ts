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

    activeTab: 'general' | 'personalization' | 'data' | 'storage' = 'general';

    // Settings
    memoryList: string[] = [];
    newMemoryText = '';
    isSavingMemory = false;
    memoryError: string | null = null;

    // Storage
    storageStats = { totalBytes: 0, messagesBytes: 0, canvasBytes: 0, messageCount: 0, canvasCount: 0 };
    storageLimit = 250 * 1024 * 1024; // 250 MB
    storagePercentage = 0;
    isLoadingStorage = false;

    // Theme mock
    theme: 'system' | 'light' | 'dark' = 'system';

    async ngOnInit() {
        // Load the general memory from Dexie
        const memorySetting = await db.settings.get('chat_general_memory');
        if (memorySetting && memorySetting.value) {
            try {
                const parsed = JSON.parse(memorySetting.value);
                if (Array.isArray(parsed)) {
                    this.memoryList = parsed;
                } else {
                    this.memoryList = [memorySetting.value];
                }
            } catch {
                this.memoryList = [memorySetting.value];
            }
        }
    }

    async loadStorageStats() {
        this.isLoadingStorage = true;
        this.storageStats = await this.chat.getStorageUsage();
        this.storagePercentage = Math.min(100, (this.storageStats.totalBytes / this.storageLimit) * 100);
        this.isLoadingStorage = false;
    }

    formatBytes(bytes: number, decimals = 2) {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }

    close() {
        this.visible = false;
        this.visibleChange.emit(this.visible);
    }

    setTab(tab: 'general' | 'personalization' | 'data' | 'storage') {
        this.activeTab = tab;
        if (tab === 'storage') {
            this.loadStorageStats();
        }
    }

    addMemory() {
        const text = this.newMemoryText.trim();
        this.memoryError = null; // Clear previous errors

        if (text && text.length <= 255) {
            if (!this.memoryList.includes(text)) {
                this.memoryList.unshift(text);
                this.saveMemory();
                this.newMemoryText = '';
            } else {
                this.memoryError = 'This memory has already been added.';
            }
        }
    }

    removeMemory(index: number) {
        this.memoryList.splice(index, 1);
        this.saveMemory();
    }

    async saveMemory() {
        this.isSavingMemory = true;
        await db.settings.put({ key: 'chat_general_memory', value: JSON.stringify(this.memoryList) });
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
