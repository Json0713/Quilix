import { Component, Input, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Task } from '../../../../core/interfaces/task';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-task-detail',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './task-detail.html',
    styleUrl: './task-detail.scss'
})
export class TaskDetailComponent implements OnInit {
    @Input({ required: true }) task!: Task;

    // In a real application, we'd fetch these from the database using the taskId
    notes: any[] = [];
    files: any[] = [];
    images: any[] = [];

    newNoteText = '';

    ngOnInit() {
        // Initialize with default mock data structure to match the exact counts
        // that were rendered on the TaskCard

        if (this.task.notesCount > 0) {
            this.notes.push({
                id: crypto.randomUUID(),
                author: 'Jane Doe',
                text: 'Reviewed the initial requirements for this task.',
                timestamp: Date.now() - 3600000
            });
        }
    }

    addNote() {
        if (!this.newNoteText.trim()) return;

        this.notes.push({
            id: crypto.randomUUID(),
            author: 'Current User',
            text: this.newNoteText,
            timestamp: Date.now()
        });

        this.task.notesCount++;
        this.newNoteText = '';

        // TODO: In Phase 26 we will wire this aggressively via the TaskService to persist
    }
}
