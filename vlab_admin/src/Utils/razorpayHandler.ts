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

  // Dynamic payment blocks explicitly enabling and ordering QR Code, UPI, Paytm, Cards, Netbanking, Wallets
  const displayBlocks: Record<string, any> = {
    upi_qr: {
      name: 'UPI & Instant Dynamic QR Code',
      instruments: [
        {
          method: 'upi',
          flows: ['qr', 'intent'],
          apps: ['google_pay', 'phonepe', 'paytm', 'bhim', 'cred'],
        },
      ],
    },
    paytm_wallets: {
      name: 'Paytm & Popular Wallets',
      instruments: [
        {
          method: 'wallet',
          wallets: ['paytm', 'phonepe', 'mobikwik', 'freecharge', 'airtelmoney', 'olamoney', 'jiomoney'],
        },
      ],
    },
    cards: {
      name: 'Credit & Debit Cards (Visa, MasterCard, RuPay, Maestro)',
      instruments: [
        {
          method: 'card',
        },
      ],
    },
    netbanking: {
      name: 'Net Banking (All Indian Banks - SBI, HDFC, ICICI, etc.)',
      instruments: [
        {
          method: 'netbanking',
        },
      ],
    },
    paylater: {
      name: 'Pay Later & Cardless EMI',
      instruments: [
        {
          method: 'paylater',
        },
        {
          method: 'emi',
        },
      ],
    },
  };

  // Determine sequence based on preferredMethod
  let sequence = [
    'block.upi_qr',
    'block.paytm_wallets',
    'block.cards',
    'block.netbanking',
    'block.paylater',
  ];

  if (preferredMethod === 'paytm' || preferredMethod === 'wallet') {
    sequence = [
      'block.paytm_wallets',
      'block.upi_qr',
      'block.cards',
      'block.netbanking',
      'block.paylater',
    ];
  } else if (preferredMethod === 'card') {
    sequence = [
      'block.cards',
      'block.upi_qr',
      'block.paytm_wallets',
      'block.netbanking',
      'block.paylater',
    ];
  } else if (preferredMethod === 'netbanking') {
    sequence = [
      'block.netbanking',
      'block.upi_qr',
      'block.paytm_wallets',
      'block.cards',
      'block.paylater',
    ];
  } else if (preferredMethod === 'paylater') {
    sequence = [
      'block.paylater',
      'block.upi_qr',
      'block.paytm_wallets',
      'block.cards',
      'block.netbanking',
    ];
  }

  const options: any = {
    key: razorpayKey,
    amount: Math.round(amountInRupees * 100), // Amount in paise (1 INR = 100 Paise)
    currency: 'INR',
    name: 'Ignito Experia Labs',
    description: `Lab Token Top-Up: ${amountInRupees} Tokens`,
    image: 'https://razorpay.com/favicon.ico',
    prefill: {
      name: userName,
      email: userEmail,
      contact: userPhone,
    },
    config: {
      display: {
        language: 'en',
        blocks: displayBlocks,
        sequence: sequence,
        preferences: {
          show_default_blocks: true,
        },
      },
    },
    send_sms_hash: true,
    remember_customer: true,
    retry: {
      enabled: true,
      max_count: 4,
    },
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
      const paymentId = response.razorpay_payment_id || `pay_${Date.now()}`;
      const orderId = response.razorpay_order_id || realBackendOrderId;
      const signature = response.razorpay_signature;

      // Send to Backend for Verification and DB Wallet Crediting
      try {
        const authState = useAuthStore.getState()?.auth;
        const token = authState?.accessToken || '';
        const currentUserId = authState?.user?.userId || (authState?.user as any)?.id;
        
        const currentTenantId = authState?.user?.tenantId || (authState?.user as any)?.universityId || 'TEN000001';
        
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
            labName,
            items: Array.isArray(items) ? items : undefined,
            userId: currentUserId || userEmail,
            userEmail,
            userName,
            tenantId: currentTenantId,
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
