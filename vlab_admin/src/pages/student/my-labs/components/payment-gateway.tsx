import  { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogOverlay } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { X, CreditCard, QrCode, Building, Lock, CheckCircle2, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PaymentGatewayProps {
  open: boolean;
  onClose: () => void;
  lab: any;
  onPaymentSuccess: (lab: any, amount: number) => void;
  initialAmount?: number;
}

const PaymentMethodItem = ({ id, label, icon: Icon, active, onSelect, subtext }: any) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={() => onSelect(id)}
    className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 flex items-center gap-4 ${
      active 
        ? 'border-red-600 bg-red-50/50 shadow-md shadow-red-100 dark:bg-red-950/20 dark:shadow-none' 
        : 'border-slate-100 bg-white dark:bg-slate-900 dark:border-slate-800 hover:border-slate-300'
    }`}
  >
    <div className={`p-3 rounded-xl ${active ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
      <Icon size={24} />
    </div>
    <div className="flex-1">
      <h4 className={`text-[14px] font-black tracking-tight ${active ? 'text-red-700 dark:text-red-500' : 'text-slate-900 dark:text-slate-200'}`}>
        {label}
      </h4>
      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
        {subtext}
      </p>
    </div>
    {active && (
      <motion.div layoutId="active-indicator" className="w-2 h-2 rounded-full bg-red-600" />
    )}
  </motion.div>
);

export function PaymentGateway({ open, onClose, lab, onPaymentSuccess, initialAmount = 500 }: PaymentGatewayProps) {
  const [step, setStep] = useState(1);
  const [method, setMethod] = useState('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [plan, setPlan] = useState(initialAmount);

  useEffect(() => {
    if (open) {
      setPlan(initialAmount);
      setStep(2);
    }
  }, [open, initialAmount]);

  const handlePay = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setStep(3);
      setTimeout(() => {
        onPaymentSuccess(lab, plan);
        onClose();
        setStep(1);
      }, 2500);
    }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="p-0 overflow-hidden sm:max-w-4xl bg-slate-50 dark:bg-slate-950 border-0 shadow-2xl rounded-[32px] [&>button]:hidden">
        <div className="flex flex-col md:flex-row min-h-[500px]">
          {/* Left Side: Order Summary */}
          <div className="w-full md:w-[350px] bg-slate-900 p-8 text-white flex flex-col">
            <div className="flex items-center gap-3 mb-12">
              <Avatar className="w-10 h-10 bg-white p-1">
                <AvatarFallback>VG</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-[14px] font-black tracking-tight leading-none">VLAB IGNITO</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Payment Gateway</p>
              </div>
            </div>

            <div className="flex-1">
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-4">You are buying</p>
              <h2 className="text-2xl font-black mb-2">{lab?.title || lab?.name || 'Lab'}</h2>
              <p className="text-slate-400 text-sm font-medium mb-8">{lab?.semester ? `Semester ${lab.semester}` : 'Academic Lab'}</p>

              <div className="bg-white/5 rounded-2xl p-6 border border-white/10 backdrop-blur-sm">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-slate-400 text-sm">Credits</span>
                  <span className="font-black">{plan}</span>
                </div>
                <div className="flex justify-between items-center mb-6">
                  <span className="text-slate-400 text-sm">Amount</span>
                  <span className="text-xl font-black text-red-500">₹{Math.round(plan * 0.85)}</span>
                </div>
                <div className="border-t border-white/10 mb-6"></div>
                <div className="flex items-center gap-2 text-emerald-400">
                  <Shield size={18} />
                  <span className="text-[11px] font-black uppercase tracking-widest">Secure 256-bit SSL</span>
                </div>
              </div>
            </div>

            <div className="mt-auto pt-8 flex items-center gap-3 text-slate-500">
              <Lock size={16} />
              <span className="text-[10px] font-bold">Payments are encrypted and secure.</span>
            </div>
          </div>

          {/* Right Side: Payment Methods */}
          <div className="flex-1 p-8 md:p-12 bg-white dark:bg-slate-950 relative">
            <button 
              onClick={onClose} 
              className="absolute top-4 right-4 p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <X size={20} className="text-slate-500" />
            </button>

            <AnimatePresence mode="wait">
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Payment Method</h2>
                  <p className="text-slate-500 text-sm mb-8">Choose your preferred way to pay.</p>

                  <div className="grid grid-cols-1 gap-4 mb-8">
                    <PaymentMethodItem 
                      id="card" 
                      label="Credit / Debit Card" 
                      icon={CreditCard} 
                      active={method === 'card'} 
                      onSelect={setMethod}
                      subtext="Visa, Mastercard, RuPay"
                    />
                    <PaymentMethodItem 
                      id="upi" 
                      label="UPI Payment" 
                      icon={QrCode} 
                      active={method === 'upi'} 
                      onSelect={setMethod}
                      subtext="Google Pay, PhonePe, Paytm"
                    />
                    <PaymentMethodItem 
                      id="netbanking" 
                      label="Net Banking" 
                      icon={Building} 
                      active={method === 'netbanking'} 
                      onSelect={setMethod}
                      subtext="All major Indian banks"
                    />
                  </div>

                  <AnimatePresence>
                    {method === 'card' && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mb-8"
                      >
                        <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                              <Input 
                                placeholder="0000 0000 0000 0000"
                                className="bg-white dark:bg-slate-950 rounded-xl"
                              />
                            </div>
                            <div>
                              <Input 
                                placeholder="MM/YY"
                                className="bg-white dark:bg-slate-950 rounded-xl"
                              />
                            </div>
                            <div>
                              <Input 
                                placeholder="CVV"
                                className="bg-white dark:bg-slate-950 rounded-xl"
                              />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex gap-4">
                    <Button
                      disabled={isProcessing}
                      onClick={handlePay}
                      className="w-full bg-red-600 py-6 rounded-2xl font-black text-[12px] uppercase tracking-[0.2em] hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400"
                    >
                      {isProcessing ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          Processing
                        </div>
                      ) : (
                        `Pay ₹${Math.round(plan * 0.85)}`
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="h-full flex flex-col items-center justify-center text-center py-12"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                    className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-8"
                  >
                    <CheckCircle2 size={60} />
                  </motion.div>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2">Payment Successful!</h2>
                  <p className="text-slate-500 font-medium mb-8">
                    {plan} credits have been added to your {lab?.title || lab?.name || 'Lab'} wallet.
                  </p>
                  <div className="w-full max-w-[300px] p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction ID</span>
                      <span className="text-[10px] font-black text-slate-900 dark:text-slate-200">#IGN-{Math.floor(Math.random() * 1000000)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</span>
                      <span className="text-[10px] font-black text-slate-900 dark:text-slate-200">{new Date().toLocaleDateString()}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
