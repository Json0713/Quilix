export interface Tab {
    id: string;
    workspaceId: string;
    windowId: string; // Physically maps tabs into discrete OS Session scopes
    label: string;
    icon: string;
    route: string;
    order: number;
}
