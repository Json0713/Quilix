export type ActivityType = 
  | 'create' 
  | 'rename' 
  | 'delete' 
  | 'trash' 
  | 'restore' 
  | 'sync_export' 
  | 'sync_import' 
  | 'move' 
  | 'error' 
  | 'warning';

export type ActivityCategory = 'workspace' | 'space' | 'file' | 'system';

export interface ActivityRecord {
    id: string;
    type: ActivityType;
    category: ActivityCategory;
    entityId: string;
    entityName: string;
    description: string;
    timestamp: number;
    oldName?: string;
    newName?: string;
    metadata?: any;
}
