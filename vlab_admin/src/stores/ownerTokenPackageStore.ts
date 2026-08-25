import { create } from 'zustand';
import { executeRequest } from '../Utils/GetApiHandler';
import { API_PATHS } from '../Utils/Api_path';
import { LabTokenPackage } from './labTokenStore';

interface OwnerTokenPackageState {
  packages: LabTokenPackage[];
  loading: boolean;
  error: string | null;

  fetchAllPackages: () => Promise<void>;
  createPackage: (data: { labId: string; tokenAmount: number; priceAmount: number; currency?: string; isActive?: boolean }) => Promise<boolean>;
  updatePackage: (id: number, data: { priceAmount?: number; tokenAmount?: number; isActive?: boolean }) => Promise<boolean>;
  togglePackageStatus: (id: number, isActive: boolean) => Promise<boolean>;
}

export const useOwnerTokenPackageStore = create<OwnerTokenPackageState>((set, get) => ({
  packages: [],
  loading: false,
  error: null,

  fetchAllPackages: async () => {
    set({ loading: true, error: null });
    try {
      const res = await executeRequest(API_PATHS.TOKENS.OWNER_PACKAGES, { auth: true });
      if (res && res.packages) {
        set({ packages: res.packages, loading: false });
      } else {
        set({ loading: false });
      }
    } catch (err: any) {
      console.error('Failed to fetch owner token packages:', err);
      set({ error: err.message || 'Failed to fetch packages', loading: false });
    }
  },

  createPackage: async (data) => {
    try {
      const res = await executeRequest(API_PATHS.TOKENS.OWNER_PACKAGES, {
        method: 'POST',
        body: JSON.stringify(data),
        auth: true,
      });
      if (res && res.success) {
        await get().fetchAllPackages();
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('Failed to create package:', err);
      return false;
    }
  },

  updatePackage: async (id, data) => {
    try {
      const res = await executeRequest(API_PATHS.TOKENS.OWNER_PACKAGE_BY_ID(id), {
        method: 'PUT',
        body: JSON.stringify(data),
        auth: true,
      });
      if (res && res.success) {
        await get().fetchAllPackages();
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('Failed to update package:', err);
      return false;
    }
  },

  togglePackageStatus: async (id, isActive) => {
    try {
      const res = await executeRequest(API_PATHS.TOKENS.OWNER_PACKAGE_STATUS(id), {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
        auth: true,
      });
      if (res && res.success) {
        await get().fetchAllPackages();
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('Failed to toggle package status:', err);
      return false;
    }
  },
}));
