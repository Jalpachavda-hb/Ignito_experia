import { create } from 'zustand';
import { fetchLabs, fetchSubLabs, updateLabCredits } from '../services/labService';
import { Lab } from '../pages/student/my-labs/types';

interface LabStore {
  labs: Lab[];
  subLabs: Record<string, any>;
  isLoading: boolean;
  error: string | null;
  addLab: (lab: Lab) => void;
  updateLab: (updatedLab: Lab) => void;
  deleteLab: (id: string) => void;
  setSubLabs: (labName: string, labs: any[]) => void;
  rechargeLab: (labId: string, newCredits: number) => Promise<void>;
  loadLabs: () => Promise<void>;
  loadSubLabs: () => Promise<void>;
}

function normalizeLab(lab: any): Lab {
  const labId = lab?.id || lab?.labId || lab?.LabId || lab?.labCode || lab?.LabCode || lab?.lab_code || (lab?.dbId ? String(lab.dbId) : "") || (lab?._id ? String(lab._id) : "") || "";
  return {
    ...lab,
    id: labId,
    labId: labId,
    title: lab?.title || lab?.Title || lab?.name || lab?.Name || 'Unnamed Lab',
    category: lab?.category || lab?.Category || 'Other Specialties',
    durationMinutes: lab?.durationMinutes ?? lab?.DurationMinutes ?? lab?.duration ?? 60,
    credits: lab?.credits ?? lab?.Credits ?? 0,
  };
}

export const useLabStore = create<LabStore>((set) => ({
  labs: [],
  subLabs: {},
  isLoading: false,
  error: null,
  addLab: (lab) => set((state) => ({ labs: [...state.labs, normalizeLab(lab)] })),
  updateLab: (updatedLab) => set((state) => ({
    labs: state.labs.map((l) => l.id === updatedLab.id ? normalizeLab(updatedLab) : l)
  })),
  deleteLab: (id) => set((state) => ({
    labs: state.labs.filter((l) => l.id !== id)
  })),
  setSubLabs: (labName, labs) => set((state) => ({
    subLabs: { ...state.subLabs, [labName]: labs }
  })),
  rechargeLab: async (labId, newCredits) => {
    try {
      const response = await updateLabCredits(labId, newCredits);
      if (response.success) {
        set((state) => ({
          labs: state.labs.map((l) => l.id === labId ? { ...l, credits: newCredits } : l)
        }));
      }
    } catch (error) {
      console.error('Recharge error:', error);
    }
  },
  loadLabs: async () => {
    set({ isLoading: true, error: null });
  
    try {
      const [labsResponse, subLabsResponse] = await Promise.all([
        fetchLabs(),
        fetchSubLabs().catch(() => ({ subLabs: {} })) // Prevent subLabs from failing the entire fetch
      ]);
  
      const rawLabs = Array.isArray(labsResponse?.labs) ? labsResponse.labs : (Array.isArray(labsResponse) ? labsResponse : []);
      const normalizedLabs = rawLabs.map(normalizeLab);

      set({
        labs: normalizedLabs,
        subLabs: subLabsResponse?.subLabs || {},
        isLoading: false,
        error: null
      });
  
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message || 'Unable to load labs'
      });
    }
  },  
  loadSubLabs: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetchSubLabs();
      set({ subLabs: response.subLabs || {} });
    } catch (error: any) {
      set({ isLoading: false, error: error.message || 'Unable to load sub-labs' });
    }
  }
}));
