/**
 * @file sheet.ts
 * @description Interfaces for the Spreadsheet feature.
 */

export interface SheetCell {
    value: string;
    bold?: boolean;
    italic?: boolean;
    color?: string;
    bgColor?: string;
    align?: 'left' | 'center' | 'right';
}

export interface SheetTab {
    id: string;
    name: string;
    cells: Record<string, SheetCell>; // e.g. "A1": { value: "Hello" }
}

export interface SheetDocument {
    id: string;
    spaceId: string;
    name: string;
    tabs: SheetTab[];
    activeTabId: string;
    createdAt: number;
    updatedAt: number;
    linkedDirectoryId?: string;
    linkedFileName?: string;
}
