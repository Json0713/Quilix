export interface NoteDocument {
    id: string;
    spaceId: string;
    name: string;
    content: string; // HTML string stored from Quill
    createdAt: number;
    updatedAt: number;
}
