import { Component, Input, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FileExplorerEntry } from '../../../../core/services/file-manager.service';

@Component({
  selector: 'app-details-view',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <div class="details-container">
      <div class="details-header">
        <div class="icon-box" [ngClass]="entry.kind">
          <i class="bi" [ngClass]="entry.kind === 'directory' ? 'bi-folder-fill' : 'bi-file-earmark-text'"></i>
        </div>
        <div class="title-group">
          <h4 class="entry-name">{{ entry.name }}</h4>
          <span class="entry-type">{{ entry.kind === 'directory' ? 'Folder' : 'File' }}</span>
        </div>
      </div>

      <div class="details-grid">
        <div class="detail-item">
          <label>Location</label>
          <span class="value">{{ entry.handle?.name || 'Current Space' }}</span>
        </div>
        
        <div class="detail-item">
          <label>Last Modified</label>
          <span class="value">{{ entry.lastModified ? (entry.lastModified | date:'medium') : 'Unknown' }}</span>
        </div>

        @if (entry.kind === 'file') {
          <div class="detail-item">
            <label>Size</label>
            <span class="value">{{ formatBytes(entry.sizeBytes) }}</span>
          </div>
        } @else {
          <div class="detail-item">
            <label>Contents</label>
            <span class="value italic">Direct size restricted by browser</span>
          </div>
        }

        <div class="detail-item">
          <label>Internal ID</label>
          <span class="value mono">{{ entry.id || 'Native Link' }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .italic { font-style: italic; opacity: 0.7; }
    .details-container {
      display: flex;
      flex-direction: column;
      gap: 24px;
      padding: 8px 0;
    }

    .details-header {
      display: flex;
      align-items: center;
      gap: 16px;
      
      .icon-box {
        width: 56px;
        height: 56px;
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        background: rgba(0, 0, 0, 0.03);
        
        &.directory { color: var(--text-main); }
        &.file { color: var(--text-muted); }
      }

      .entry-name {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--text-main);
        word-break: break-all;
      }

      .entry-type {
        font-size: 0.85rem;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        font-weight: 600;
      }
    }

    .details-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;

      @media (max-width: 480px) {
        grid-template-columns: 1fr;
      }
    }

    .detail-item {
      display: flex;
      flex-direction: column;
      gap: 4px;

      label {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.02em;
      }

      .value {
        font-size: 0.95rem;
        color: var(--text-main);
        word-break: break-all;
        overflow-wrap: break-word;
        
        &.mono {
          font-family: var(--font-mono, monospace);
          font-size: 0.8rem;
          opacity: 0.8;
        }
      }
    }
  `]
})
export class DetailsView {
  @Input({ required: true }) entry!: FileExplorerEntry;

  formatBytes(bytes: number | undefined): string {
    if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return '--';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = 2;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}
