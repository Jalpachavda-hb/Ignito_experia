import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Database, Flame, CreditCard, MonitorPlay } from 'lucide-react';
import { Lab } from '../../my-labs/types';

interface CatalogueLabCardProps {
  lab: Lab;
  isPopular?: boolean;
  onPurchaseCredit?: (lab: Lab) => void;
  onDetails?: (labId: string) => void;
}

export function CatalogueLabCard({ 
  lab, 
  isPopular, 
  onPurchaseCredit, 
  onDetails 
}: CatalogueLabCardProps) {
  const labId = lab.id || lab.labId || lab.LabId || lab.labCode || lab.LabCode || lab._id || '';
  const name = lab.title || lab.name || 'Unnamed Lab';
  const imageUrl = lab.logo || lab.image || lab.icon || null;
  const time = lab.durationMinutes || lab.duration || 60;
  const credits = lab.credits || 0;
  
  return (
    <Card 
      onClick={() => onPurchaseCredit?.(lab)}
      className="group flex flex-col justify-between p-4 sm:p-5 bg-white hover:bg-slate-50/70 transition-all duration-300 border border-slate-200/70 hover:border-red-200 rounded-[20px] cursor-pointer h-full shadow-[0_2px_8px_rgb(0,0,0,0.04)] hover:shadow-[0_10px_25px_rgb(239,68,68,0.12)]"
    >
      <div className="space-y-4">
        {/* Top Row: Logo & Title */}
        <div className="flex items-start gap-3.5">
          <div className="shrink-0 h-[72px] w-[72px] rounded-2xl bg-[#f8fafc] border border-slate-100 flex items-center justify-center p-2.5 transition-transform duration-300 group-hover:scale-105 shadow-sm">
            {imageUrl ? (
              <img src={imageUrl} alt={name} className="max-w-full max-h-full object-contain drop-shadow-sm" />
            ) : (
              <MonitorPlay className="h-7 w-7 text-slate-400" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              {isPopular && (
                <Badge className="shrink-0 bg-red-50 text-red-500 hover:bg-red-100 border-none shadow-sm flex items-center gap-1 font-semibold px-2 py-0.5 text-[10px] whitespace-nowrap">
                  <Flame className="w-3 h-3 fill-red-500 text-red-500" /> Popular
                </Badge>
              )}
            </div>
            <h3 className="text-[14px] sm:text-[15px] font-bold text-slate-900 leading-snug group-hover:text-red-600 transition-colors line-clamp-2">
              {name}
            </h3>
          </div>
        </div>

        {/* Middle Row: Meta Info */}
        <div className="flex items-center justify-between text-[11px] sm:text-[12px] font-medium text-slate-500 bg-slate-50/80 px-3 py-2 rounded-xl border border-slate-100">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" /> 
            <span>Time: {time}m</span>
          </div>
          <div className="w-[1px] h-3 bg-slate-300 shrink-0"></div>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <Database className="w-3.5 h-3.5 text-red-500 shrink-0" /> 
            <span className="font-semibold text-slate-700">Credits: {credits}</span>
          </div>
        </div>
      </div>

      {/* Bottom Action: Purchase Credit button */}
      <div className="mt-4 pt-1">
        <Button 
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            onPurchaseCredit?.(lab);
          }}
          className="w-full border-2 border-red-500/80 text-red-600 bg-red-50/20 hover:bg-red-600 hover:text-white font-bold text-[11px] sm:text-[12px] h-10 rounded-[12px] transition-all duration-300 flex items-center justify-center gap-2 shadow-none"
        >
          <CreditCard className="w-4 h-4 shrink-0" />
          <span>Purchase Credit to perform your tasks</span>
        </Button>
      </div>
    </Card>
  );
}

