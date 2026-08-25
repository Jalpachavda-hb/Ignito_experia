import React, { useEffect, useState } from 'react';
import { useLabTokenStore, LabTokenPackage } from '@/stores/labTokenStore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Coins, ShoppingCart, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface TokenPackagesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetLabId?: string;
  labTitle?: string;
}

export const TokenPackagesModal: React.FC<TokenPackagesModalProps> = ({
  open,
  onOpenChange,
  targetLabId,
  labTitle,
}) => {
  const {
    availablePackages,
    packagesByLab,
    cart,
    fetchAvailablePackages,
    addToCart,
    removeFromCart,
    clearCart,
    createOrderAndCheckout,
    verifyPayment,
  } = useLabTokenStore();

  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchAvailablePackages();
    }
  }, [open, fetchAvailablePackages]);

  // Load Razorpay script dynamically
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const normalizedTarget = targetLabId ? String(targetLabId).toLowerCase().trim() : '';
  const labPackages: LabTokenPackage[] = targetLabId
    ? packagesByLab[targetLabId] || availablePackages.filter((p) => String(p.LabId).toLowerCase().trim() === normalizedTarget)
    : availablePackages;

  const handleSelectPackage = (pkg: LabTokenPackage) => {
    addToCart({
      packageId: pkg.Id,
      labId: pkg.LabId,
      tokenAmount: pkg.TokenAmount,
      priceAmount: pkg.PriceAmount,
      labTitle: labTitle || pkg.LabId,
    });
    toast.success(`Added ${pkg.TokenAmount} Tokens to Cart!`);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('Please select at least one token package to purchase.');
      return;
    }

    setCheckoutLoading(true);
    try {
      const orderInfo = await createOrderAndCheckout();
      
      const options = {
        key: orderInfo.keyId,
        amount: Math.round(orderInfo.totalAmount * 100),
        currency: 'INR',
        name: 'Ignito Experia Labs',
        description: `Lab Token Package Purchase (${cart.reduce((a, b) => a + b.tokenAmount, 0)} Tokens)`,
        order_id: orderInfo.gatewayOrderId.startsWith('rzp_order_mock_') ? undefined : orderInfo.gatewayOrderId,
        handler: async (response: any) => {
          setCheckoutLoading(true);
          const success = await verifyPayment(orderInfo.orderId, {
            razorpayOrderId: response.razorpay_order_id || orderInfo.gatewayOrderId,
            razorpayPaymentId: response.razorpay_payment_id || `pay_mock_${Date.now()}`,
            razorpaySignature: response.razorpay_signature || 'mock_sig',
          });

          setCheckoutLoading(false);
          if (success) {
            toast.success('Payment successful! Tokens credited to your lab wallet.');
            onOpenChange(false);
          } else {
            toast.error('Payment verification failed. Please contact support.');
          }
        },
        modal: {
          ondismiss: () => {
            setCheckoutLoading(false);
          },
        },
        prefill: {},
        theme: {
          color: '#4F46E5',
        },
      };

      if (window.Razorpay && !orderInfo.gatewayOrderId.startsWith('rzp_order_mock_')) {
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        // Test environment settlement trigger
        toast.info('Processing order settlement...');
        const success = await verifyPayment(orderInfo.orderId, {
          razorpayOrderId: orderInfo.gatewayOrderId,
          razorpayPaymentId: `pay_mock_${Date.now()}`,
          razorpaySignature: 'mock_sig',
        });
        setCheckoutLoading(false);
        if (success) {
          toast.success('Payment Successful! Tokens credited to lab wallet.');
          onOpenChange(false);
        }
      }
    } catch (err: any) {
      setCheckoutLoading(false);
      toast.error(err.message || 'Checkout failed.');
    }
  };

  const totalCartAmount = cart.reduce((sum, item) => sum + item.priceAmount, 0);
  const totalCartTokens = cart.reduce((sum, item) => sum + item.tokenAmount, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Coins className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            <DialogTitle className="text-xl font-bold">
              {labPackages.length > 0
                ? (labTitle ? `Purchase Tokens for ${labTitle}` : 'Lab Token Packages')
                : 'Token Packages Unavailable'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-gray-500">
            {labPackages.length > 0
              ? '1 Token = 1 Minute (60 Seconds) of Lab Practice. Unused tokens remain safely in your lab wallet for future sessions.'
              : `The administrator has not yet configured active token packages for ${labTitle || 'this lab'}. Please try again later or contact your administrator.`}
          </DialogDescription>
        </DialogHeader>

        {/* Packages Grid or Clean Unavailable View */}
        <div className="my-4">
          {labPackages.length === 0 ? (
            <div className="p-8 text-center border border-dashed rounded-xl bg-gray-50 dark:bg-gray-900/50 flex flex-col items-center justify-center gap-3">
              <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h4 className="text-base font-bold text-gray-900 dark:text-white">Token Packages Unavailable</h4>
                <p className="text-xs text-gray-500 max-w-md mt-1">
                  Active pricing packages have not been configured for {labTitle || 'this virtual lab'}. Please reach out to your administrator to enable token packages.
                </p>
              </div>
              <Button
                variant="outline"
                className="mt-2 text-xs font-semibold px-6"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {labPackages.map((pkg) => {
                const inCart = cart.some((c) => c.packageId === pkg.Id);
                return (
                  <Card
                    key={pkg.Id}
                    className={`relative border-2 transition-all hover:border-indigo-500 ${
                      inCart ? 'border-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/20' : 'border-gray-200 dark:border-gray-800'
                    }`}
                  >
                    {inCart && (
                      <Badge className="absolute top-2 right-2 bg-indigo-600 text-white">
                        In Cart
                      </Badge>
                    )}
                    <CardHeader className="pb-2">
                      <CardTitle className="text-2xl font-black text-indigo-600 dark:text-indigo-400 flex items-baseline gap-1">
                        {pkg.TokenAmount} <span className="text-sm font-normal text-gray-500">Tokens</span>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        = {pkg.TokenAmount} Minutes Practice Time
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="text-3xl font-extrabold text-gray-900 dark:text-white mb-4">
                        ₹{pkg.PriceAmount}
                      </div>

                      {inCart ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => removeFromCart(pkg.Id)}
                        >
                          Remove from Cart
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                          onClick={() => handleSelectPackage(pkg)}
                        >
                          <ShoppingCart className="h-4 w-4 mr-1.5" />
                          Add to Cart
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Cart Summary */}
        {cart.length > 0 && labPackages.length > 0 && (
          <div className="mt-4 p-4 border rounded-xl bg-gray-50 dark:bg-gray-900 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-indigo-600" />
                Cart Summary ({cart.length} item{cart.length > 1 ? 's' : ''})
              </div>
              <p className="text-xs text-gray-500">
                Total: <span className="font-bold text-gray-900 dark:text-white">{totalCartTokens} Tokens</span> for{' '}
                <span className="font-bold text-indigo-600 dark:text-indigo-400">₹{totalCartAmount}</span>
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button variant="ghost" size="sm" onClick={clearCart}>
                Clear
              </Button>
              <Button
                disabled={checkoutLoading}
                className="bg-green-600 hover:bg-green-700 text-white font-bold px-6"
                onClick={handleCheckout}
              >
                {checkoutLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Checkout ₹{totalCartAmount}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
