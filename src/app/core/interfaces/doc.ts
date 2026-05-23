/**
 * @file doc.ts
 * @description Interfaces for the Docs (full document editor) feature.
 */

export type DocMarginPreset = 'normal' | 'narrow' | 'wide';
export type DocOrientation = 'portrait' | 'landscape';
export type DocPageSize = 'letter' | 'a4' | 'legal';

export interface DocPageLayout {
    margins: DocMarginPreset;
    orientation: DocOrientation;
    pageSize: DocPageSize;
}

export const DEFAULT_PAGE_LAYOUT: DocPageLayout = {
    margins: 'normal',
    orientation: 'portrait',
    pageSize: 'letter'
};

export const PAGE_SIZES: Record<DocPageSize, { w: number; h: number }> = {
    letter: { w: 816, h: 1056 },   // 8.5" × 11"
    a4:     { w: 794, h: 1123 },   // 210mm × 297mm
    legal:  { w: 816, h: 1344 }    // 8.5" × 14"
};

export const MARGIN_PRESETS: Record<DocMarginPreset, { top: number; right: number; bottom: number; left: number }> = {
    normal: { top: 96, right: 96, bottom: 96, left: 96 },
    narrow: { top: 48, right: 48, bottom: 48, left: 48 },
    wide:   { top: 96, right: 144, bottom: 96, left: 144 }
};

export interface DocDocument {
    id: string;
    spaceId: string;
    name: string;
    content: string;       // HTML string stored from Quill
    wordCount: number;      // Auto-computed on save
    pageLayout?: DocPageLayout;
    createdAt: number;
    updatedAt: number;
    linkedDirectoryId?: string;
    linkedFileName?: string;
}
