import React, { useEffect, useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { Search, Loader2, Beaker, LayoutGrid, List, Zap, CreditCard, X, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useLabStore } from '@/stores/labStore';
import { useAuthStore } from '@/stores/auth-store';
import { useTransactionStore } from '@/stores/transactionStore';
import { useLabTokenStore } from '@/stores/labTokenStore';
import { initiateRazorpayPayment, detectPaymentMethod } from '@/Utils/razorpayHandler';
import { LabCreditCard, LabTokenInfo } from './components/lab-credit-card';

export interface CartItem {
  lab: any;
  tokens: number;
  pricePer60Tokens: number;
  amountRupees: number;
}

export default function CreditWallet() {
  const { labs, isLoading, loadLabs } = useLabStore();
  const { auth } = useAuthStore();
  const { user } = auth;
  const { addTransaction } = useTransactionStore();
  const { labWallets, fetchStudentLabTokens } = useLabTokenStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  // Multi-Lab Combined Bill Cart State
  const [cartItems, setCartItems] = useState<Record<string, CartItem>>({});
  const [isCheckoutProcessing, setIsCheckoutProcessing] = useState(false);
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState('');

  useEffect(() => {
    loadLabs();
    fetchStudentLabTokens();
  }, [loadLabs, fetchStudentLabTokens]);

  // Compute live lab token info map from real database labWallets
  const labTokensMap = useMemo(() => {
    const map: Record<string, LabTokenInfo> = {};

    (labWallets || []).forEach((w) => {
      const rawId = String(w.labId || '').toLowerCase().trim();
      const cleanId = rawId.replace(/^lab-/, '').replace(/-lab$/, '');
      const remaining = Number(w.remainingTokens ?? Math.max(0, (w.purchasedTokens || 0) - (w.usedTokens || 0)));

      const info = { availableTokens: remaining, reservedTokens: 0 };
      map[cleanId] = info;
      map[rawId] = info;
      map[`lab-${cleanId}`] = info;
      map[`${cleanId}-lab`] = info;
    });

    labs.forEach((lab) => {
      const rawId = String(lab.id || lab.labId || lab.name || '').toLowerCase().trim();
      const cleanId = rawId.replace(/^lab-/, '').replace(/-lab$/, '');

      if (map[cleanId] === undefined && map[rawId] === undefined) {
        const remaining = Number(lab.userTokens ?? lab.availableTokens ?? lab.remainingTokens ?? lab.tokens ?? 0);
        const info = { availableTokens: remaining, reservedTokens: 0 };
        map[cleanId] = info;
        map[rawId] = info;
      }
    });

    return map;
  }, [labWallets, labs]);

  const handleToggleSelectForCart = (lab: any, currentTokens: number = 60) => {
    const labId = lab.id || lab.labId;
    setCartItems((prev) => {
      const copy = { ...prev };
      if (copy[labId]) {
        delete copy[labId];
      } else {
        const pricePer60 = lab.baseTokenPrice ?? 100;
        const amount = Math.round(currentTokens * (pricePer60 / 60));
        copy[labId] = {
          lab,
          tokens: currentTokens,
          pricePer60Tokens: pricePer60,
          amountRupees: amount
        };
      }
      return copy;
    });
  };

  const handleTokensChangeForLab = (lab: any, newTokens: number) => {
    const labId = lab.id || lab.labId;
    setCartItems((prev) => {
      if (!prev[labId]) return prev;
      const pricePer60 = lab.baseTokenPrice ?? 100;
      const amount = Math.round(newTokens * (pricePer60 / 60));
      return {
        ...prev,
        [labId]: {
          ...prev[labId],
          tokens: newTokens,
          amountRupees: amount
        }
      };
    });
  };

  const selectedItemsList = useMemo(() => Object.values(cartItems), [cartItems]);
  const totalCombinedTokens = useMemo(() => selectedItemsList.reduce((sum, item) => sum + item.tokens, 0), [selectedItemsList]);
  const totalCombinedPaymentRupees = useMemo(() => selectedItemsList.reduce((sum, item) => sum + item.amountRupees, 0), [selectedItemsList]);

  const handlePayCombinedBill = async () => {
    if (totalCombinedPaymentRupees <= 0 || selectedItemsList.length === 0) return;

    setIsCheckoutProcessing(true);

    const labNamesSummary = selectedItemsList.map(item => `${item.lab.title || item.lab.name} (${item.tokens} Tokens)`).join(', ');

    await initiateRazorpayPayment({
      amountInRupees: totalCombinedPaymentRupees,
      labName: `Combined Tokens Bill: ${selectedItemsList.length} Labs`,
      labId: selectedItemsList.map(i => i.lab.id).join(','),
      userEmail: user?.email || '',
      userName: user?.fullName || user?.name || 'Student User',
      userPhone: user?.phoneNumber || user?.mobile || '',
      onSuccess: async (paymentId, details) => {
        setIsCheckoutProcessing(false);

        await fetchStudentLabTokens();

        const method = detectPaymentMethod(details);
        addTransaction({
          razorpayPaymentId: paymentId,
          description: `Combined Token Order: ${labNamesSummary}`,
          labName: `${selectedItemsList.length} Labs Combined`,
          labId: selectedItemsList.map(i => i.lab.id).join(','),
          type: 'Credit',
          amount: totalCombinedTokens,
          amountRupees: totalCombinedPaymentRupees,
          paymentMethod: method,
          studentEmail: user?.email || 'student@vlab.edu',
          studentPhone: user?.phoneNumber || '+91 9876543210',
          studentName: user?.fullName || 'Student User',
          status: 'Completed',
        });

        setCartItems({});
        setPaymentSuccessMessage(`Combined bill of ₹${totalCombinedPaymentRupees} paid successfully! Tokens credited.`);
        setTimeout(() => setPaymentSuccessMessage(''), 5000);
      },
      onFailure: (err) => {
        setIsCheckoutProcessing(false);
      },
      onDismiss: () => {
        setIsCheckoutProcessing(false);
      }
    });
  };

  // Filter labs by search query
  const filteredLabs = useMemo(() => {
    return labs.filter(lab => {
      const matchesSearch = (lab.name || lab.title || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [labs, searchQuery]);

  return (
    <>
      <Header className="justify-between bg-white dark:bg-card border-b border-border/40 px-6 h-16 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground font-medium">
            <span>Student Portal</span>
            <span className="text-border">/</span>
            <span className="text-slate-900 dark:text-white font-semibold">Token Wallet</span>
          </div>
        </div>
      </Header>

      <Main className="bg-[#f8fafc] dark:bg-slate-950 min-h-[calc(100vh-4rem)] pb-28">
        <div className="w-full px-4 md:px-6 xl:px-10 py-6 space-y-6 max-w-[1600px] mx-auto">

          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-2xl">
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Lab Token Wallet
              </h1>
              <p className="text-slate-500 mt-2 text-sm md:text-base leading-relaxed">
                Manage your lab runtime tokens (1 Token = 1 Minute). Select tokens for 1 or more labs to pay a single combined bill via Razorpay.
              </p>
            </div>
            
            <div className="shrink-0 bg-white border border-slate-200 shadow-sm rounded-2xl p-4 flex items-center gap-4 min-w-[200px]">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                <Beaker className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Total Enrolled Labs</p>
                <p className="text-xl font-extrabold text-slate-900 leading-none">{labs.length}</p>
              </div>
            </div>
          </div>

          {paymentSuccessMessage && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-800 flex items-center gap-3 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="text-sm font-bold">{paymentSuccessMessage}</span>
            </div>
          )}

          {/* Toolbar (Search & View Toggle) */}
          <div className="bg-white rounded-[20px] p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Search labs by name..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-slate-50 border-slate-200 rounded-[12px] h-11 text-sm font-semibold placeholder:font-medium"
              />
            </div>
            
            <div className="flex w-full md:w-auto items-center gap-3 justify-end">
              {/* View Toggle */}
              <div className="flex items-center bg-slate-50 p-1 rounded-[12px] border border-slate-200 shrink-0">
                <button 
                  onClick={() => setView('grid')}
                  className={`p-1.5 rounded-[8px] transition-colors ${view === 'grid' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                  title="Grid View"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setView('list')}
                  className={`p-1.5 rounded-[8px] transition-colors ${view === 'list' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                  title="List View"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          {isLoading && labs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32">
              <Loader2 className="h-10 w-10 animate-spin text-red-500 mb-4" />
              <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Loading token allocations...</p>
            </div>
          ) : filteredLabs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[24px] border border-slate-200 border-dashed">
              <Beaker className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-slate-500 font-bold text-lg mb-1">No Labs Found</p>
              <p className="text-slate-400 text-sm">Try adjusting your search query.</p>
            </div>
          ) : (
            <div className={view === 'grid' ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6" : "flex flex-col gap-4"}>
              {filteredLabs.map(lab => {
                const labId = lab.id || lab.labId;
                const rawId = String(labId || lab.name || '').toLowerCase().trim();
                const cleanId = rawId.replace(/^lab-/, '').replace(/-lab$/, '');
                const tokenInfo = labTokensMap[cleanId] || labTokensMap[rawId] || { availableTokens: 0, reservedTokens: 0 };
                const isSelected = Boolean(cartItems[labId]);
                return (
                  <LabCreditCard 
                    key={labId} 
                    lab={lab} 
                    tokenInfo={tokenInfo}
                    isSelectedForCart={isSelected}
                    onToggleSelectForCart={() => handleToggleSelectForCart(lab, cartItems[labId]?.tokens || 60)}
                    onTokensChange={(newTokens) => handleTokensChangeForLab(lab, newTokens)}
                    view={view}
                  />
                );
              })}
            </div>
          )}

        </div>
      </Main>

      {/* Floating Glassmorphic Combined Token Order Dock */}
      {selectedItemsList.length > 0 && (
        <div className="fixed bottom-5 left-4 right-4 z-50 max-w-[1400px] mx-auto bg-slate-900/95 backdrop-blur-xl text-white border border-slate-700/80 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl p-4 sm:px-6 animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0 w-full md:w-auto">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 shadow-md shadow-red-500/30 flex items-center justify-center text-white shrink-0">
                <Zap className="w-6 h-6 fill-white text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-white tracking-tight">Combined Token Order</span>
                  <span className="text-[11px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-md font-bold">
                    {selectedItemsList.length} Labs Selected • +{totalCombinedTokens} Mins Runtime
                  </span>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto text-[11px] text-slate-300 font-medium mt-1">
                  {selectedItemsList.map((item, idx) => (
                    <span key={item.lab.id || idx} className="shrink-0 bg-slate-800/90 px-2.5 py-0.5 rounded-lg border border-slate-700/80 text-slate-200">
                      {item.lab.title || item.lab.name}: <span className="text-red-400 font-extrabold">+{item.tokens} Tokens</span> (₹{item.amountRupees})
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0 w-full md:w-auto justify-end">
              <div className="text-right">
                <span className="text-[10px] uppercase font-extrabold text-slate-400 block tracking-wider">Total Bill</span>
                <span className="text-2xl font-black text-white tracking-tight">₹{totalCombinedPaymentRupees}</span>
              </div>

              <Button
                size="lg"
                onClick={handlePayCombinedBill}
                disabled={isCheckoutProcessing}
                className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-extrabold text-sm h-11 px-6 rounded-xl shadow-lg shadow-red-500/25 flex items-center gap-2 active:scale-95 transition-all shrink-0 border-none"
              >
                {isCheckoutProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4.5 h-4.5 text-white" />
                )}
                Proceed to Payment (₹{totalCombinedPaymentRupees})
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCartItems({})}
                className="text-slate-400 hover:text-white hover:bg-slate-800 h-9 w-9 rounded-xl transition-colors"
                title="Clear Selection"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
