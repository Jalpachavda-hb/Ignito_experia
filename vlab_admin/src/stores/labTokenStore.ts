import { create } from 'zustand';
import { executeRequest } from '../Utils/GetApiHandler';
import { API_PATHS } from '../Utils/Api_path';

export interface LabTokenWallet {
  id: number;
  labId: string;
  purchasedTokens: number;
  usedTokens: number;
  remainingTokens: number;
  runtimeRemainingMinutes: number;
  updatedAt?: string;
}

export interface LabTokenPackage {
  Id: number;
  LabId: string;
  TokenAmount: number;
  PriceAmount: number;
  Currency: string;
  IsActive: boolean;
}

export interface CartItem {
  packageId: number;
  labId: string;
  tokenAmount: number;
  priceAmount: number;
  labTitle?: string;
}

export interface TokenOrder {
  Id: number;
  OrderNumber: string;
  TotalTokens: number;
  TotalAmount: number;
  Currency: string;
  Status: string;
  PaidAt?: string;
  CreatedAt: string;
  items?: Array<{
    Id: number;
    LabId: string;
    TokenAmount: number;
    UnitPrice: number;
    TotalAmount: number;
  }>;
}

interface LabTokenState {
  summary: {
    totalPurchased: number;
    totalUsed: number;
    totalRemaining: number;
  };
  labWallets: LabTokenWallet[];
  availablePackages: LabTokenPackage[];
  packagesByLab: Record<string, LabTokenPackage[]>;
  cart: CartItem[];
  orders: TokenOrder[];
  loading: boolean;
  error: string | null;

  fetchStudentLabTokens: () => Promise<void>;
  fetchAvailablePackages: () => Promise<void>;
  fetchStudentOrders: () => Promise<void>;
  addToCart: (item: CartItem) => void;
  removeFromCart: (packageId: number) => void;
  clearCart: () => void;
  createOrderAndCheckout: () => Promise<{ orderId: number; keyId: string; gatewayOrderId: string; totalAmount: number }>;
  verifyPayment: (orderId: number, razorpayData: { razorpayOrderId?: string; razorpayPaymentId?: string; razorpaySignature?: string }) => Promise<boolean>;
}

export const useLabTokenStore = create<LabTokenState>((set, get) => ({
  summary: {
    totalPurchased: 0,
    totalUsed: 0,
    totalRemaining: 0,
  },
  labWallets: [],
  availablePackages: [],
  packagesByLab: {},
  cart: [],
  orders: [],
  loading: false,
  error: null,

  fetchStudentLabTokens: async () => {
    set({ loading: true, error: null });
    try {
      const res = await executeRequest(API_PATHS.TOKENS.STUDENT_SUMMARY, { auth: true });
      if (res && res.summary) {
        set({
          summary: res.summary,
          labWallets: res.labs || [],
          loading: false,
        });
      } else {
        set({ loading: false });
      }
    } catch (err: any) {
      console.error('Failed to fetch student lab tokens:', err);
      set({ error: err.message || 'Failed to fetch lab tokens', loading: false });
    }
  },

  fetchAvailablePackages: async () => {
    try {
      const res = await executeRequest(API_PATHS.TOKENS.STUDENT_PACKAGES, { auth: true });
      if (res && res.packages) {
        set({
          availablePackages: res.packages || [],
          packagesByLab: res.labs || {},
        });
      }
    } catch (err: any) {
      console.error('Failed to fetch token packages:', err);
    }
  },

  fetchStudentOrders: async () => {
    try {
      const res = await executeRequest(API_PATHS.TOKENS.STUDENT_ORDERS, { auth: true });
      if (res && res.orders) {
        set({ orders: res.orders || [] });
      }
    } catch (err: any) {
      console.error('Failed to fetch student orders:', err);
    }
  },

  addToCart: (item) => {
    set((state) => {
      // Prevent duplicate package ID in cart
      const exists = state.cart.some((c) => c.packageId === item.packageId);
      if (exists) return state;
      return { cart: [...state.cart, item] };
    });
  },

  removeFromCart: (packageId) => {
    set((state) => ({
      cart: state.cart.filter((item) => item.packageId !== packageId),
    }));
  },

  clearCart: () => set({ cart: [] }),

  createOrderAndCheckout: async () => {
    const { cart } = get();
    if (cart.length === 0) {
      throw new Error('Cart is empty');
    }

    const payload = {
      items: cart.map((c) => ({ packageId: c.packageId })),
    };

    const res = await executeRequest(API_PATHS.TOKENS.CREATE_ORDER, {
      method: 'POST',
      body: JSON.stringify(payload),
      auth: true,
    });

    if (!res || !res.orderId) {
      throw new Error(res?.message || 'Failed to create token order');
    }

    return {
      orderId: res.orderId,
      keyId: res.keyId,
      gatewayOrderId: res.gatewayOrderId,
      totalAmount: res.totalAmount,
    };
  },

  verifyPayment: async (orderId, razorpayData) => {
    try {
      const res = await executeRequest(API_PATHS.TOKENS.VERIFY_PAYMENT(orderId), {
        method: 'POST',
        body: JSON.stringify(razorpayData),
        auth: true,
      });

      if (res && res.success) {
        get().clearCart();
        await get().fetchStudentLabTokens();
        await get().fetchStudentOrders();
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('Payment verification failed:', err);
      return false;
    }
  },
}));
