import { Component, Input, OnChanges, SimpleChanges, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { FileExplorerEntry, FileManagerService } from '../../../../core/services/components/file-manager.service';
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

    viewType = signal<'pdf' | 'docx' | 'xlsx' | 'image' | 'text' | 'unsupported'>('unsupported');
    loading = signal<boolean>(false);
    error = signal<string | null>(null);

    // Excel specific
    workbook: XLSX.WorkBook | null = null;
    sheetNames = signal<string[]>([]);
    activeSheet = signal<string>('');

    safeContent: SafeHtml | null = null;
    safeUrl: SafeResourceUrl | null = null;
    textContent: string | null = null;
    isTruncated = signal<boolean>(false);

    private activeObjectURL: string | null = null;

    async ngOnChanges(changes: SimpleChanges) {
        if (changes['entry'] && this.entry) {
            await this.loadPreview();
        }
    }

    private async loadPreview() {
        if (!this.entry) return;

        this.loading.set(true);
        this.error.set(null);
        this.viewType.set('unsupported');
        this.safeContent = null;
        this.safeUrl = null;
        this.textContent = null;
        this.workbook = null;
        this.sheetNames.set([]);
        this.activeSheet.set('');
        this.isTruncated.set(false);

        this.cleanupObjectURL();

        try {
            const blob = await this.fileManager.getFileBlob(this.entry);
            if (!blob) throw new Error('Could not retrieve file data.');

            const ext = this.entry.name.split('.').pop()?.toLowerCase() || '';

            if (ext === 'pdf') {
                this.viewType.set('pdf');
                this.activeObjectURL = URL.createObjectURL(blob);
                this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.activeObjectURL);
            } 
            else if (['docx', 'doc'].includes(ext)) {
                this.viewType.set('docx');
                const arrayBuffer = await blob.arrayBuffer();
                const result = await mammoth.convertToHtml({ arrayBuffer });
                this.safeContent = this.sanitizer.bypassSecurityTrustHtml(result.value);
            } 
            else if (['xlsx', 'xls', 'csv'].includes(ext)) {
                this.viewType.set('xlsx');
                const arrayBuffer = await blob.arrayBuffer();
                this.workbook = XLSX.read(arrayBuffer, { type: 'array' });
                this.sheetNames.set(this.workbook.SheetNames);
                if (this.workbook.SheetNames.length > 0) {
                    this.switchSheet(this.workbook.SheetNames[0]);
                }
            } 
            else if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
                this.viewType.set('image');
                this.activeObjectURL = URL.createObjectURL(blob);
                this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.activeObjectURL);
            }
            else if (['txt', 'md', 'json', 'js', 'ts', 'html', 'css', 'scss'].includes(ext)) {
                this.viewType.set('text');
                
                // PERFORMANCE: Prevent browser crash with massive text files
                const TEXT_PREVIEW_LIMIT = 512 * 1024; // 512KB
                if (blob.size > TEXT_PREVIEW_LIMIT) {
                    const slice = blob.slice(0, TEXT_PREVIEW_LIMIT);
                    this.textContent = await slice.text();
                    this.isTruncated.set(true);
                } else {
                    this.textContent = await blob.text();
                }
            }
            else {
                this.viewType.set('unsupported');
            }

        } catch (err: any) {
            console.error('[OfficeViewer] Error loading preview:', err);
            this.error.set(err.message || 'An error occurred while loading the preview.');
        } finally {
            this.loading.set(false);
        }
    }

    switchSheet(name: string) {
        if (!this.workbook) return;
        this.activeSheet.set(name);
        const worksheet = this.workbook.Sheets[name];
        
        // PERFORMANCE: Truncate massive spreadsheets to prevent DOM lag
        const ref = worksheet['!ref'];
        if (ref) {
            const range = XLSX.utils.decode_range(ref);
            const totalCells = (range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1);
            
            // Limit to ~20k cells for preview
            if (totalCells > 20000) {
                range.e.r = Math.min(range.e.r, range.s.r + 1000); // Limit to 1000 rows
                range.e.c = Math.min(range.e.c, range.s.c + 20);   // Limit to 20 columns
                worksheet['!ref'] = XLSX.utils.encode_range(range);
                this.isTruncated.set(true);
            } else {
                this.isTruncated.set(false);
            }
        }

        const html = XLSX.utils.sheet_to_html(worksheet);
        const styledHtml = `<div class="table-wrapper">${html}</div>`;
        this.safeContent = this.sanitizer.bypassSecurityTrustHtml(styledHtml);
    }

    private cleanupObjectURL() {
        if (this.activeObjectURL) {
            URL.revokeObjectURL(this.activeObjectURL);
            this.activeObjectURL = null;
        }
    }

    ngOnDestroy() {
        this.cleanupObjectURL();
    }
}
