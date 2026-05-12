import { Component, Input, OnChanges, SimpleChanges, inject, signal, SecurityContext } from '@angular/core';
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
export class OfficeViewerComponent implements OnChanges {
    private fileManager = inject(FileManagerService);
    private sanitizer = inject(DomSanitizer);

    @Input({ required: true }) entry: FileExplorerEntry | null = null;

    viewType = signal<'pdf' | 'docx' | 'xlsx' | 'image' | 'text' | 'unsupported'>('unsupported');
    loading = signal<boolean>(false);
    error = signal<string | null>(null);

    safeContent: SafeHtml | null = null;
    safeUrl: SafeResourceUrl | null = null;
    textContent: string | null = null;

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

        try {
            const blob = await this.fileManager.getFileBlob(this.entry);
            if (!blob) throw new Error('Could not retrieve file data.');

            const ext = this.entry.name.split('.').pop()?.toLowerCase() || '';

            if (ext === 'pdf') {
                this.viewType.set('pdf');
                const url = URL.createObjectURL(blob);
                this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
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
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const html = XLSX.utils.sheet_to_html(worksheet);
                this.safeContent = this.sanitizer.bypassSecurityTrustHtml(html);
            } 
            else if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
                this.viewType.set('image');
                const url = URL.createObjectURL(blob);
                this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
            }
            else if (['txt', 'md', 'json', 'js', 'ts', 'html', 'css', 'scss'].includes(ext)) {
                this.viewType.set('text');
                this.textContent = await blob.text();
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
}
