import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Printer, 
  CheckCircle2, 
  Mail, 
  Phone, 
  ShieldCheck, 
  X, 
  Globe, 
  FileText
} from 'lucide-react';
import { TransactionRecord } from '@/stores/transactionStore';

interface ReceiptModalProps {
  transaction: TransactionRecord | null;
  open: boolean;
  onClose: () => void;
}

export function ReceiptModal({ transaction, open, onClose }: ReceiptModalProps) {
  if (!transaction) return null;

  const formattedDate = new Date(transaction.date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const formattedTime = new Date(transaction.date).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const handlePrint = () => {
    window.print();
  };

  const invoiceNo = `INV-${new Date(transaction.date).getFullYear()}-${transaction.id.replace(/[^0-9]/g, '').slice(-6) || '902418'}`;
  const amountPaid = transaction.amountRupees ?? transaction.amount;
  const creditsAdded = transaction.amount;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="p-0 overflow-hidden sm:max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl [&>button]:hidden print:shadow-none print:border-none print:max-w-full print:bg-white print:rounded-none">
        
        {/* Top Header Controls (Light background, sharp corners) */}
        <div className="bg-slate-100 dark:bg-slate-800/80 px-6 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Payment Receipt & Tax Invoice</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handlePrint}
              className="h-8 px-3 text-xs font-bold gap-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> Print / Save PDF
            </Button>
            <button
              onClick={onClose}
              className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Clean Corporate Printable Invoice Sheet (No round border, no black background) */}
        <div className="p-6 sm:p-8 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans print:p-0" id="printable-receipt">
          
          {/* Header Section: Company Brand & Invoice Info */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-9 h-9 rounded bg-indigo-600 flex items-center justify-center text-white font-black text-lg">
                  V
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white uppercase leading-none">IGNITO EXPERIA</h1>
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">VIRTUAL LABORATORY SYSTEMS</span>
                </div>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-normal mt-2">
                Ignito Experia Learning Tech Pvt. Ltd.<br />
                Innovation Park, Sector 5, Tech Zone<br />
                GSTIN: <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">24AAACI9841F1Z8</span>
              </div>
            </div>

            <div className="sm:text-right space-y-1">
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 text-[10px] font-bold px-2.5 py-0.5 rounded uppercase tracking-wider mb-1">
                <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" /> PAID
              </Badge>
              <div className="text-lg font-bold text-slate-900 dark:text-white font-mono">{invoiceNo}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Date: <span className="font-semibold text-slate-800 dark:text-slate-200">{formattedDate}</span> ({formattedTime})
              </div>
              {transaction.razorpayPaymentId && (
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  Razorpay ID: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{transaction.razorpayPaymentId}</span>
                </div>
              )}
            </div>
          </div>

          {/* Billed To & Payment Method Info (Clean Sharp Border Boxes) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-6 border-b border-slate-200 dark:border-slate-800">
            {/* Billed To */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Billed To (Student)</span>
              <div className="text-sm font-bold text-slate-900 dark:text-white">{transaction.studentName || 'Student User'}</div>
              <div className="text-xs text-slate-600 dark:text-slate-400 font-medium space-y-0.5 mt-1">
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3 h-3 text-slate-400" /> {transaction.studentEmail || 'student@ignito.edu'}
                </div>
                {transaction.studentPhone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-slate-400" /> {transaction.studentPhone}
                  </div>
                )}
              </div>
            </div>

            {/* Payment Info */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded border border-slate-200 dark:border-slate-800 space-y-1 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Payment Particulars</span>
              <div className="flex justify-between">
                <span className="text-slate-500">Method:</span>
                <span className="font-bold text-slate-900 dark:text-white">{transaction.paymentMethod || 'Razorpay'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Currency:</span>
                <span className="font-bold text-slate-900 dark:text-white">INR (₹)</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
                <span className="text-slate-500">Status:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Cleared & Verified
                </span>
              </div>
            </div>
          </div>

          {/* Clean Item Table (Light Grey Header) */}
          <div className="py-5">
            <table className="w-full text-xs text-left border border-slate-200 dark:border-slate-800">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 w-12 text-center">Sr.</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">Item Description</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 text-center">Rate</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 text-center">Credits</th>
                  <th className="py-2.5 px-3 text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                <tr>
                  <td className="py-3 px-3 text-center text-slate-500 border-r border-slate-200 dark:border-slate-800 font-mono">01</td>
                  <td className="py-3 px-3 border-r border-slate-200 dark:border-slate-800">
                    <div className="font-bold text-slate-900 dark:text-white">
                      {transaction.description || 'Lab Credit Top-Up'}
                    </div>
                    {transaction.labName && (
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Lab: {transaction.labName}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center border-r border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-mono">₹1.00 / Cr</td>
                  <td className="py-3 px-3 text-center border-r border-slate-200 dark:border-slate-800 font-bold text-indigo-600 dark:text-indigo-400">
                    +{creditsAdded} Cr
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white font-mono">
                    ₹{amountPaid}.00
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Financial Calculation Box (Clean Light Slate Box) */}
          <div className="flex flex-col sm:flex-row justify-between items-end gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1 max-w-sm">
              <div className="font-bold text-slate-700 dark:text-slate-300">Notes & Authorization:</div>
              <p>
                Computer generated payment receipt. Credits have been allocated to your student account balance.
              </p>
            </div>

            <div className="w-full sm:w-64 bg-slate-50 dark:bg-slate-900 p-4 rounded border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Subtotal:</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white">₹{amountPaid}.00</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Taxes & GST (0%):</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white">₹0.00</span>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-800 pt-1.5 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase">Grand Total:</span>
                <span className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono">₹{amountPaid}.00</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-400 font-medium gap-2">
            <div className="flex items-center gap-1">
              <Globe className="w-3 h-3 text-indigo-600" /> www.ignitolearn.com
            </div>
            <div>Support: support@ignitolearn.com</div>
            <div>Ignito Experia &copy; {new Date().getFullYear()}</div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
