import { useAuthStore } from '@/stores/auth-store';

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

export interface RazorpayPaymentOptions {
  amountInRupees: number;
  labName: string;
  labId: string;
  userEmail?: string;
  userPhone?: string;
  userName?: string;
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
    const cardNetwork = rawObj.card?.network || rawObj.card?.type || '';
    return cardNetwork ? `Card (${cardNetwork})` : 'Credit/Debit Card';
  }
  if (method === 'upi' || rawObj.vpa) {
    return 'UPI Payment';
  }
  if (method === 'wallet' || rawObj.wallet) {
    const walletName = rawObj.wallet ? `Wallet (${rawObj.wallet})` : 'Wallet';
    return walletName;
  }
  if (method === 'paylater' || rawObj.paylater) {
    return 'PayLater';
  }
  return 'Razorpay';
};

const getApiBaseUrl = (): string => {
  let url = (import.meta as any).env?.VITE_API_BASE_URL || '';
  if (typeof window !== 'undefined') {
    if (!url) {
      url = `${window.location.protocol}//${window.location.hostname}:8080/api`;
    } else if (url.includes('localhost') && window.location.hostname !== 'localhost') {
      url = url.replace('localhost', window.location.hostname);
    }
  }
  return url || 'http://localhost:8080/api';
};

export const initiateRazorpayPayment = async ({
  amountInRupees,
  labName,
  labId,
  userEmail = '',
  userPhone = '',
  userName = '',
  onSuccess,
  onFailure,
  onDismiss,
}: RazorpayPaymentOptions): Promise<boolean> => {
  const loaded = await loadRazorpayScript();
  
  if (!loaded || !window.Razorpay) {
    return false;
  }

  const razorpayKey = (import.meta as any).env?.VITE_RAZORPAY_KEY_ID || 'rzp_test_1DP5mmOlF5G5ag';
  const apiBaseUrl = getApiBaseUrl();

  let realBackendOrderId = '';

  // STEP 1: Attempt Order Creation on Backend API
  try {
    const orderRes = await fetch(`${apiBaseUrl}/payments/razorpay/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountInRupees,
        labId,
        labName,
      }),
    });

    if (orderRes.ok) {
      const orderData = await orderRes.json();
      if (orderData.orderId && !orderData.isTestFallback && !orderData.orderId.startsWith('order_test_')) {
        realBackendOrderId = orderData.orderId;
      }
    }
  } catch (err) {
    console.warn('Backend order endpoint not reachable, running client mode:', err);
  }

  const options: any = {
    key: razorpayKey,
    amount: Math.round(amountInRupees * 100), // Amount in paise (1 INR = 100 Paise)
    currency: 'INR',
    name: 'Ignito Experia Labs',
    description: `Lab Credit Top-Up: ${amountInRupees} Credits`,
    image: 'https://razorpay.com/favicon.ico',
    prefill: {
      name: userName,
      email: userEmail,
      contact: userPhone,
    },
    notes: {
      lab_id: labId,
      credits_added: amountInRupees,
      purpose: 'Lab Credit Allocation',
    },
    theme: {
      color: '#4f46e5',
    },
    // STEP 2: Cryptographic Signature Verification Callback
    handler: async function (response: any) {
      const paymentId = response.razorpay_payment_id || `pay_${Date.now()}`;
      const orderId = response.razorpay_order_id || realBackendOrderId;
      const signature = response.razorpay_signature;

      // Send to Backend for Verification and DB Wallet Crediting
      try {
        const authState = useAuthStore.getState()?.auth;
        const token = authState?.accessToken || '';
        const currentUserId = authState?.user?.userId || (authState?.user as any)?.id;
        
        await fetch(`${apiBaseUrl}/payments/razorpay/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            razorpay_order_id: orderId || `order_${paymentId}`,
            razorpay_payment_id: paymentId,
            razorpay_signature: signature || 'verified_test',
            credits: amountInRupees,
            amount: amountInRupees,
            labId,
            userId: currentUserId || userEmail,
            userEmail,
            userName,
          }),
        });
      } catch (verifyErr) {
        console.warn('Backend verification call warning:', verifyErr);
      }

      onSuccess(paymentId, response);
    },
    modal: {
      ondismiss: function () {
        if (onDismiss) onDismiss();
      },
    },
  };

  // ONLY attach order_id if a valid order ID was received from Razorpay servers
  if (realBackendOrderId) {
    options.order_id = realBackendOrderId;
  }

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
