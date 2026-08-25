export interface LabActivityRecord {
  id: string;
  labName: string;
  status: 'In Progress' | 'Completed' | 'Stopped' | 'Not Started';
  creditsUsed: number;
  completionPercentage: number;
  lastAccessed: string;
}

function getStorageKey(userId?: string): string {
  const cleanId = userId || 'anonymous_student';
  return `ignito_student_lab_history_${cleanId}`;
}

export function saveLabActivity(userId: string | undefined, record: LabActivityRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getStorageKey(userId);
    const existingRaw = localStorage.getItem(key);
    let list: LabActivityRecord[] = existingRaw ? JSON.parse(existingRaw) : [];

    // Filter out previous record of same lab to place updated record at top
    list = list.filter(item => item.id !== record.id);

    // Unshift updated record to top
    list.unshift(record);

    // Store top 20 entries
    localStorage.setItem(key, JSON.stringify(list.slice(0, 20)));
  } catch (err) {
    console.error('Failed to save lab activity to storage:', err);
  }
}

export function getSavedLabActivities(userId: string | undefined): LabActivityRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = getStorageKey(userId);
    const existingRaw = localStorage.getItem(key);
    if (!existingRaw) return [];
    return JSON.parse(existingRaw);
  } catch (err) {
    return [];
  }
}

export function markLabCompleted(userId: string | undefined, labId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getStorageKey(userId);
    const existingRaw = localStorage.getItem(key);
    if (!existingRaw) return;
    const list: LabActivityRecord[] = JSON.parse(existingRaw);

    const updated = list.map(item => {
      if (item.id === labId) {
        return {
          ...item,
          status: 'Completed' as const,
          completionPercentage: 100,
          lastAccessed: new Date().toISOString()
        };
      }
      return item;
    });

    localStorage.setItem(key, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to mark lab completed:', err);
  }
}
