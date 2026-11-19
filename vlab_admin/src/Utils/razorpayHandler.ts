import { useAuthStore } from '@/stores/auth-store';
import { BASE_URL } from '@/Utils/Api_path';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      resolve(true);
    };
    script.onerror = () => {
      resolve(false);
    };
    document.body.appendChild(script);
  });
};

export interface RazorpayCartItem {
  labId: string;
  labName: string;
  tokens: number;
  amountRupees: number;
}

export interface RazorpayPaymentOptions {
  amountInRupees: number;
  labName: string;
  labId: string;
  items?: RazorpayCartItem[];
  userEmail?: string;
  userPhone?: string;
  userName?: string;
  preferredMethod?: 'upi_qr' | 'upi' | 'paytm' | 'card' | 'netbanking' | 'wallet' | 'paylater';
  onSuccess: (paymentId: string, details: any) => void;
  onFailure?: (errorDetails: any) => void;
  onDismiss?: () => void;
}

const BANK_NAMES: Record<string, string> = {
  BARB_R: 'Bank of Baroda',
  BARB: 'Bank of Baroda',
  PUNB_R: 'Punjab National Bank',
  PUNB: 'Punjab National Bank',
  SBIN: 'State Bank of India',
  HDFC: 'HDFC Bank',
  ICIC: 'ICICI Bank',
  UTIB: 'Axis Bank',
  KKBK: 'Kotak Mahindra Bank',
  CNRB: 'Canara Bank',
  UBIN: 'Union Bank of India',
  IDIB: 'Indian Bank',
  MAHB: 'Bank of Maharashtra',
  IOBA: 'Indian Overseas Bank',
  CORP: 'Corporation Bank',
  PSIB: 'Punjab & Sind Bank',
};

export const detectPaymentMethod = (response: any): string => {
  if (!response) return 'Razorpay';
  const rawObj = response.error?.metadata || response;
  const method = (rawObj.method || rawObj.payment_method || '').toLowerCase();
  const bankCode = (rawObj.bank || rawObj.bank_code || '').toUpperCase();
  const bankName = BANK_NAMES[bankCode] || (bankCode ? bankCode : '');

  if (method === 'netbanking' || bankCode) {
    return bankName ? `Netbanking (${bankName})` : 'Netbanking';
  }
  if (method === 'card' || rawObj.card_id || rawObj.card) {
    const cardNetwork = (rawObj.card?.network || rawObj.card?.type || '').toUpperCase();
    return cardNetwork ? `Card (${cardNetwork})` : 'Credit/Debit Card';
  }
  if (method === 'upi' || rawObj.vpa) {
    const vpa = String(rawObj.vpa || '').toLowerCase();
    const flow = String(rawObj.flow || '').toLowerCase();
    if (vpa.includes('paytm')) return 'Paytm UPI';
    if (vpa.includes('okhdfcbank') || vpa.includes('okaxis') || vpa.includes('okicici') || vpa.includes('oksbi')) return 'Google Pay (UPI)';
    if (vpa.includes('ybl') || vpa.includes('ibl') || vpa.includes('axl')) return 'PhonePe (UPI)';
    if (flow === 'qr' || rawObj.qr) return 'UPI (QR Code)';
    return 'UPI Payment';
  }
  if (method === 'wallet' || rawObj.wallet) {
    const w = String(rawObj.wallet || '').toLowerCase();
    if (w === 'paytm') return 'Paytm Wallet';
    if (w === 'phonepe') return 'PhonePe Wallet';
    if (w === 'mobikwik') return 'MobiKwik';
    if (w === 'freecharge') return 'Freecharge';
    if (w === 'airtelmoney') return 'Airtel Money';
    if (w === 'olamoney') return 'Ola Money';
    if (w === 'jiomoney') return 'JioMoney';
    return rawObj.wallet ? `Wallet (${rawObj.wallet})` : 'Wallet';
  }
  if (method === 'paylater' || rawObj.paylater) {
    return 'PayLater';
  }
  if (method === 'emi' || rawObj.emi) {
    return 'EMI Payment';
  }
  return 'Razorpay';
};

const getApiBaseUrl = (): string => {
  if (BASE_URL) {
    return BASE_URL.replace(/\/+$/, '');
  }
  let url = (import.meta as any).env?.VITE_API_BASE_URL || '';
  if (typeof window !== 'undefined') {
    if (!url) {
      url = `${window.location.protocol}//${window.location.hostname}:8080/api`;
    } else if (url.includes('localhost') && window.location.hostname !== 'localhost') {
      url = url.replace('localhost', window.location.hostname);
    }
  }
  return (url || 'http://localhost:8080/api').replace(/\/+$/, '');
};

const getAuthToken = (): string => {
  const authState = useAuthStore.getState()?.auth;
  let token = authState?.accessToken || '';
  if (!token && typeof window !== 'undefined') {
    try {
      token = localStorage.getItem('auth-access-token') || localStorage.getItem('accessToken') || '';
    } catch {
      // ignore
    }
  }
  return String(token).trim().replace(/^Bearer\s+/i, '').replace(/^"|"$/g, '');
};

export const initiateRazorpayPayment = async ({
  amountInRupees,
  labName,
  labId,
  items,
  userEmail = '',
  userPhone = '',
  userName = '',
  preferredMethod,
  onSuccess,
  onFailure,
  onDismiss,
}: RazorpayPaymentOptions): Promise<boolean> => {
  const loaded = await loadRazorpayScript();
  
  if (!loaded || !window.Razorpay) {
    if (onFailure) onFailure({ message: 'Failed to load Razorpay SDK. Please check your internet connection.' });
    return false;
  }

  const apiBaseUrl = getApiBaseUrl();
  const token = getAuthToken();
  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let realBackendOrderId = '';
  let razorpayKey = (import.meta as any).env?.VITE_RAZORPAY_KEY_ID || '';

  try {
    const orderRes = await fetch(`${apiBaseUrl}/payments/razorpay/create-order`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        amountInRupees,
        labId,
        labName,
        credits: Array.isArray(items)
          ? items.reduce((sum, it) => sum + Number(it.tokens || 0), 0)
          : amountInRupees,
        items,
      }),
    });

    const orderData = await orderRes.json().catch(() => ({}));
    if (!orderRes.ok || !orderData.orderId || !String(orderData.orderId).startsWith('order_')) {
      const message = orderData.message || 'Could not create a Razorpay order';
      if (onFailure) onFailure({ message });
      return false;
    }
    realBackendOrderId = orderData.orderId;
    if (orderData.key) razorpayKey = orderData.key;
  } catch (err) {
    if (onFailure) onFailure(err);
    return false;
  }

  if (!razorpayKey) {
    if (onFailure) onFailure({ message: 'Razorpay key is not configured' });
    return false;
  }

  const calculatedTotalTokens = Array.isArray(items) && items.length > 0
    ? items.reduce((sum, it) => sum + Number(it.tokens || 0), 0)
    : amountInRupees;

  const prefillObj: Record<string, string> = {};
  if (userName?.trim()) prefillObj.name = userName.trim();
  if (userEmail?.trim()) prefillObj.email = userEmail.trim();
  if (userPhone?.trim()) prefillObj.contact = userPhone.trim();
  if (preferredMethod === 'card') prefillObj.method = 'card';
  else if (preferredMethod === 'netbanking') prefillObj.method = 'netbanking';
  else if (preferredMethod === 'wallet' || preferredMethod === 'paytm') prefillObj.method = 'wallet';
  else if (preferredMethod === 'upi' || preferredMethod === 'upi_qr') prefillObj.method = 'upi';

  const options: any = {
    key: razorpayKey,
    amount: Math.round(amountInRupees * 100), // Amount in paise (1 INR = 100 Paise)
    currency: 'INR',
    name: 'Ignito Experia Labs',
    description: `Lab Token Top-Up: ${calculatedTotalTokens} Tokens (₹${amountInRupees})`,
    image: 'https://razorpay.com/favicon.ico',
    prefill: prefillObj,
    notes: {
      lab_id: labId,
      credits_added: amountInRupees,
      purpose: 'Lab Token Allocation',
      payment_options: 'QR_UPI_PAYTM_CARDS_NETBANKING',
    },
    theme: {
      color: '#4f46e5',
    },
    // STEP 2: Cryptographic Signature Verification Callback
    handler: async function (response: any) {
      const paymentId = response?.razorpay_payment_id;
      const orderId = response?.razorpay_order_id || realBackendOrderId;
      const signature = response?.razorpay_signature;

      if (!paymentId || !orderId || !signature) {
        if (onFailure) onFailure({ message: 'Razorpay did not return a payment signature' });
        return;
      }

      const calculatedTokens = Array.isArray(items) && items.length > 0
        ? items.reduce((sum: number, it: any) => sum + Number(it.tokens || 0), 0)
        : Number(amountInRupees);

      try {
        const currentUser = useAuthStore.getState()?.auth;
        const currentTenantId = currentUser?.user?.tenantId || (currentUser?.user as any)?.universityId || 'TEN000001';

        const verifyRes = await fetch(`${apiBaseUrl}/payments/razorpay/verify`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            razorpay_order_id: orderId,
            razorpay_payment_id: paymentId,
            razorpay_signature: signature,
            credits: calculatedTokens,
            amount: amountInRupees,
            labId,
            labName,
            items: Array.isArray(items) ? items : undefined,
            userEmail,
            userName,
            tenantId: currentTenantId,
          }),
        });
        const verifyData = await verifyRes.json().catch(() => ({}));
        if (!verifyRes.ok || !verifyData.success) {
          if (onFailure) onFailure({ message: verifyData.message || 'Payment verification failed' });
          return;
        }
      } catch (verifyErr) {
        if (onFailure) onFailure(verifyErr);
        return;
      }

      onSuccess(paymentId, response);
    },
    modal: {
      ondismiss: function () {
        if (onDismiss) onDismiss();
      },
    },
  };

  options.order_id = realBackendOrderId;

  try {
    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function (response: any) {
      console.warn('Razorpay payment failed response:', response);
      if (onFailure) {
        onFailure(response);
      }
    });
    rzp.open();
    return true;
  } catch (error) {
    console.error('Error opening Razorpay checkout:', error);
    if (onFailure) {
      onFailure(error);
    }
    return false;
  }
};
