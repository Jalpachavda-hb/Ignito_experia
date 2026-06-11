export interface Lab {
  id: string;
  name?: string;
  title?: string; // Some backends use title instead of name
  description?: string;
  category?: string;
  difficulty?: 'Beginner' | 'Intermediate' | 'Advanced' | string;
  credits?: number;
  duration?: number; // In minutes
  image?: string;
  icon?: string;
  status?: 'Not Started' | 'In Progress' | 'Completed' | 'Paused' | 'Expired' | 'active' | 'inactive';
  semester?: string;
  [key: string]: any; // Allow other properties from backend
}

export interface LabSession {
  sessionId: string;
  labId: string;
  userId: string;
  status: 'running' | 'starting' | 'stopped' | 'failed';
  message?: string;
  publicIp?: string;
  tools?: {
    jupyter?: { url?: string; enabled?: boolean };
    main?: { url?: string; type?: string };
    [key: string]: any;
  };
}

export type ViewMode = 'grid' | 'list';
export type SortOption = 'Name' | 'Recently Accessed' | 'Credits' | 'Duration';
export type FilterStatus = 'All Labs' | 'In Progress' | 'Completed' | 'Not Started';
