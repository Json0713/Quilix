import { Component, Input } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';

@Component({
  selector: 'app-workspace-details',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <div class="details-container">
      <div class="details-header">
        <div class="icon-box" [ngClass]="workspace.role">
          <i class="bi" [ngClass]="workspace.role === 'team' ? 'bi-people-fill' : 'bi-person-fill'"></i>
        </div>
        <div class="title-group">
          <h4 class="entry-name">{{ workspace.name }}</h4>
          <span class="entry-type">Workspace</span>
        </div>
      </div>

      <div class="details-grid">
        <div class="detail-item">
          <label>Role</label>
          <span class="value" style="text-transform: capitalize;">{{ workspace.role }}</span>
        </div>

        <div class="detail-item">
          <label>Status</label>
          <span class="value" [class.text-danger]="workspace.isMissingOnDisk">
            {{ workspace.isMissingOnDisk ? 'Missing from Disk' : 'Online' }}
          </span>
        </div>
        
        <div class="detail-item">
          <label>Created On</label>
          <span class="value">{{ workspace.createdAt ? (workspace.createdAt | date:'medium') : 'Unknown' }}</span>
        </div>

        <div class="detail-item">
          <label>Last Active</label>
          <span class="value">{{ workspace.lastActiveAt ? (workspace.lastActiveAt | date:'medium') : 'Never' }}</span>
        </div>

        <div class="detail-item">
          <label>Total Size</label>
          <span class="value">{{ formatBytes(workspace.sizeBytes) }}</span>
        </div>

        <div class="detail-item full-width">
          <label>Native Path</label>
          <span class="value mono">{{ workspace.folderPath || 'Virtual Storage' }}</span>
        </div>

        <div class="detail-item full-width">
          <label>Workspace ID</label>
          <span class="value mono">{{ workspace.id }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
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
        
        &.personal { color: var(--bs-primary); background: rgba(var(--bs-primary-rgb), 0.1); }
        &.team { color: #8b5cf6; background: rgba(139, 92, 246, 0.1); }
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

      .full-width {
        grid-column: 1 / -1;
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

    .text-danger {
      color: var(--bs-danger) !important;
      font-weight: 600;
    }
  `]
})
export class WorkspaceDetailsComponent {
  @Input({ required: true }) workspace!: any;

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
