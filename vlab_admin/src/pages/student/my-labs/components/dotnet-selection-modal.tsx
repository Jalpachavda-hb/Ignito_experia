import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Terminal, Globe, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DotnetSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (subtype: 'console' | 'mvc') => void;
}

export function DotnetSelectionModal({ open, onOpenChange, onConfirm }: DotnetSelectionModalProps) {
  const [selected, setSelected] = useState<'console' | 'mvc' | null>(null);

  const handleConfirm = () => {
    if (selected) {
      onConfirm(selected);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-50 rounded-xl p-6 max-w-md w-[90vw] overflow-hidden shadow-lg">
        <DialogHeader className="text-center">
          <DialogTitle className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Choose .NET Project Type
          </DialogTitle>
          <DialogDescription className="text-slate-500 dark:text-slate-400 text-sm mt-1.5">
            Select the template architecture to initialize for your virtual lab environment.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
          {/* Console Application Card */}
          <div
            onClick={() => setSelected('console')}
            className={cn(
              "group relative flex flex-col items-center justify-between p-5 rounded-xl border cursor-pointer transition-all duration-200 select-none",
              selected === 'console'
                ? "border-red-500 bg-red-50/30 dark:bg-red-950/10 shadow-sm"
                : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-900 hover:border-slate-350 dark:hover:border-slate-700"
            )}
          >
            <div className="flex flex-col items-center text-center">
              <div className={cn(
                "w-12 h-12 rounded-lg flex items-center justify-center mb-3 transition-colors duration-200",
                selected === 'console'
                  ? "bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-350"
              )}>
                <Terminal size={22} />
              </div>
              <h3 className="font-bold text-sm mb-1 text-slate-800 dark:text-slate-200">Console App</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                Command-line template. Ideal for logic, algorithms, and simple programs.
              </p>
            </div>
            {selected === 'console' && (
              <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center shadow-sm animate-in zoom-in-50 duration-200">
                <Check size={10} className="text-white stroke-[3]" />
              </div>
            )}
          </div>

          {/* MVC Web Application Card */}
          <div
            onClick={() => setSelected('mvc')}
            className={cn(
              "group relative flex flex-col items-center justify-between p-5 rounded-xl border cursor-pointer transition-all duration-200 select-none",
              selected === 'mvc'
                ? "border-red-500 bg-red-50/30 dark:bg-red-950/10 shadow-sm"
                : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-900 hover:border-slate-350 dark:hover:border-slate-700"
            )}
          >
            <div className="flex flex-col items-center text-center">
              <div className={cn(
                "w-12 h-12 rounded-lg flex items-center justify-center mb-3 transition-colors duration-200",
                selected === 'mvc'
                  ? "bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-350"
              )}>
                <Globe size={22} />
              </div>
              <h3 className="font-bold text-sm mb-1 text-slate-800 dark:text-slate-200">MVC Web App</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                Model-View-Controller framework template. Ideal for web sites and APIs.
              </p>
            </div>
            {selected === 'mvc' && (
              <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center shadow-sm animate-in zoom-in-50 duration-200">
                <Check size={10} className="text-white stroke-[3]" />
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 w-full mt-2">
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            className="flex-1 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selected}
            className={cn(
              "flex-1 font-semibold text-white",
              selected
                ? "bg-red-600 hover:bg-red-700 active:bg-red-800 shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed"
            )}
          >
            Launch Lab
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
