import { Component, Input, OnChanges, SimpleChanges, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { FileExplorerEntry, FileManagerService } from '../../../../core/services/components/file-manager.service';
import { Subject, from, of } from 'rxjs';
import { switchMap, takeUntil, catchError, tap } from 'rxjs/operators';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';

@Component({
    selector: 'app-office-viewer',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './office-viewer.html',
    styleUrl: './office-viewer.scss'
})
export class OfficeViewerComponent implements OnChanges, OnDestroy {
    private fileManager = inject(FileManagerService);
    private sanitizer = inject(DomSanitizer);

    @Input({ required: true }) entry: FileExplorerEntry | null = null;

    // View State
    viewType = signal<'pdf' | 'docx' | 'xlsx' | 'image' | 'text' | 'unsupported'>('unsupported');
    loading = signal<boolean>(false);
    error = signal<string | null>(null);
    isTruncated = signal<boolean>(false);

    // Content State
    workbook: XLSX.WorkBook | null = null;
    sheetNames = signal<string[]>([]);
    activeSheet = signal<string>('');
    safeContent: SafeHtml | null = null;
    safeUrl: SafeResourceUrl | null = null;
    textContent: string | null = null;

    // Reactive Pipeline
    private loadRequest$ = new Subject<FileExplorerEntry>();
    private destroy$ = new Subject<void>();
    private activeObjectURL: string | null = null;

    constructor() {
        this.initLoadPipeline();
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['entry']) {
            this.loadRequest$.next(this.entry!);
        }
    }

    private initLoadPipeline() {
        this.loadRequest$.pipe(
            // Use switchMap to cancel previous loads automatically
            switchMap(entry => {
                this.resetState();
                if (!entry) return of(null);
                return from(this.processEntry(entry)).pipe(
                    catchError(err => {
                        console.error('[OfficeViewer] Pipeline error:', err);
                        this.error.set(err.message || 'Failed to load preview.');
                        return of(null);
                    })
                );
            }),
            takeUntil(this.destroy$)
        ).subscribe();
    }

    private resetState() {
        this.loading.set(true);
        this.error.set(null);
        this.viewType.set('unsupported');
        this.isTruncated.set(false);
        this.cleanupResources();
    }

    private async processEntry(entry: FileExplorerEntry) {
        const blob = await this.fileManager.getFileBlob(entry);
        if (!blob) throw new Error('File data unavailable.');

        const ext = entry.name.split('.').pop()?.toLowerCase() || '';
        
        switch (true) {
            case ext === 'pdf':
                this.renderPdf(blob);
                break;
            case ['docx', 'doc'].includes(ext):
                await this.renderDocx(blob);
                break;
            case ['xlsx', 'xls', 'csv'].includes(ext):
                await this.renderXlsx(blob);
                break;
            case ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext):
                this.renderImage(blob);
                break;
            case ['txt', 'md', 'json', 'js', 'ts', 'html', 'css', 'scss'].includes(ext):
                await this.renderText(blob);
                break;
            default:
                this.viewType.set('unsupported');
        }
        this.loading.set(false);
    }

    // --- Specific Renderers ---

    private renderPdf(blob: Blob) {
        this.viewType.set('pdf');
        this.activeObjectURL = URL.createObjectURL(blob);
        this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.activeObjectURL);
    }

    private async renderDocx(blob: Blob) {
        this.viewType.set('docx');
        const buffer = await blob.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
        this.safeContent = this.sanitizer.bypassSecurityTrustHtml(result.value);
    }

    private async renderXlsx(blob: Blob) {
        this.viewType.set('xlsx');
        const buffer = await blob.arrayBuffer();
        this.workbook = XLSX.read(buffer, { type: 'array' });
        this.sheetNames.set(this.workbook.SheetNames);
        if (this.workbook.SheetNames.length > 0) {
            this.switchSheet(this.workbook.SheetNames[0]);
        }
    }

    private renderImage(blob: Blob) {
        this.viewType.set('image');
        this.activeObjectURL = URL.createObjectURL(blob);
        this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.activeObjectURL);
    }

    private async renderText(blob: Blob) {
        this.viewType.set('text');
        const LIMIT = 512 * 1024;
        if (blob.size > LIMIT) {
            this.textContent = await blob.slice(0, LIMIT).text();
            this.isTruncated.set(true);
        } else {
            this.textContent = await blob.text();
        }
    }

    // --- Utility Methods ---

    switchSheet(name: string) {
        if (!this.workbook) return;
        this.activeSheet.set(name);
        const ws = this.workbook.Sheets[name];
        
        // Performance Guard for large sheets
        const ref = ws['!ref'];
        if (ref) {
            const range = XLSX.utils.decode_range(ref);
            const cells = (range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1);
            if (cells > 20000) {
                range.e.r = Math.min(range.e.r, range.s.r + 1000);
                range.e.c = Math.min(range.e.c, range.s.c + 20);
                ws['!ref'] = XLSX.utils.encode_range(range);
                this.isTruncated.set(true);
            }
        }

        const html = XLSX.utils.sheet_to_html(ws);
        this.safeContent = this.sanitizer.bypassSecurityTrustHtml(`<div class="table-wrapper">${html}</div>`);
    }

    private cleanupResources() {
        if (this.activeObjectURL) URL.revokeObjectURL(this.activeObjectURL);
        this.activeObjectURL = null;
        this.workbook = null;
        this.safeContent = null;
        this.textContent = null;
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
        this.cleanupResources();
    }
}
