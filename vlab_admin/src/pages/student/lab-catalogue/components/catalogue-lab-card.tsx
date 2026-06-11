import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Database, MonitorPlay, ArrowRight, Flame, Square, ArrowUpRight, Loader2 } from 'lucide-react';
import { Lab } from '../../my-labs/types';
import { LabSession } from '@/services/labService';

interface CatalogueLabCardProps {
  lab: Lab;
  isPopular?: boolean;
  onStart?: (labId: string) => void;
  onDetails?: (labId: string) => void;
  onStop?: (labId: string) => void;
  onResume?: (labId: string) => void;
  activeSession?: LabSession;
  elapsedTime?: string;
  isStarting?: boolean;
  isStopping?: boolean;
}

export function CatalogueLabCard({ 
  lab, 
  isPopular, 
  onStart, 
  onDetails,
  onStop,
  onResume,
  activeSession,
  elapsedTime,
  isStarting,
  isStopping 
}: CatalogueLabCardProps) {
  const name = lab.title || lab.name || 'Unnamed Lab';
  const imageUrl = lab.logo || lab.image || lab.icon || null;
  const time = lab.durationMinutes || lab.duration || 60;
  const credits = lab.credits || 0;
  
  const isRunning = activeSession?.status === 'running';
  const displayTime = elapsedTime || '0:00';
  
  return (
    <Card 
      onClick={() => onDetails?.(lab.id)}
      className={`group flex items-stretch p-4 bg-white hover:bg-slate-50/50 transition-all duration-300 border-slate-200/60 rounded-[20px] cursor-pointer h-full ${
        isRunning ? 'ring-2 ring-emerald-500/20 shadow-emerald-500/5 hover:shadow-emerald-500/10' : 'hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)]'
      }`}
    >
      {/* Left: Logo Container */}
      <div className="shrink-0 h-[76px] w-[76px] sm:h-[84px] sm:w-[84px] rounded-2xl bg-[#f8fafc] border border-slate-100 flex items-center justify-center p-3 transition-transform duration-500 group-hover:scale-105">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="max-w-full max-h-full object-contain drop-shadow-sm" />
        ) : (
          <MonitorPlay className="h-8 w-8 text-slate-400" />
        )}
      </div>

      {/* Right: Content Area */}
      <div className="flex-1 min-w-0 flex flex-col justify-between ml-4">
        
        {/* Top Row: Title & Badge */}
        <div className="flex justify-between items-start gap-3">
          <h3 className="text-[14px] sm:text-[15px] font-bold text-slate-900 leading-snug line-clamp-2 group-hover:text-red-600 transition-colors pt-1">
            {name}
          </h3>
          {isRunning ? (
            <Badge className="shrink-0 bg-emerald-50 text-emerald-600 border-emerald-200/50 font-bold px-2 py-0.5 text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
              {displayTime}
            </Badge>
          ) : isPopular ? (
            <Badge className="shrink-0 bg-red-50 text-red-500 hover:bg-red-100 border-none shadow-sm flex items-center gap-1 font-semibold px-2 py-0.5 text-[10px] whitespace-nowrap">
              <Flame className="w-3 h-3" /> Popular
            </Badge>
          ) : null}
        </div>
        
        {/* Bottom Row: Meta Info & Action Button */}
        <div className="flex justify-between items-end mt-3 gap-2">
          
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] sm:text-[12px] font-medium text-slate-500 pb-1">
            <div className="flex items-center gap-1 whitespace-nowrap">
              <Clock className="w-3.5 h-3.5 shrink-0" /> 
              <span>Time: {time}m</span>
            </div>
            <div className="hidden sm:block w-[1px] h-3 bg-slate-300 shrink-0"></div>
            <div className="flex items-center gap-1 whitespace-nowrap">
              <Database className="w-3.5 h-3.5 shrink-0" /> 
              <span>Credits: {credits}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isRunning ? (
              <>
                <Button 
                  onClick={(e) => { e.stopPropagation(); onStop?.(lab.id); }}
                  disabled={isStopping}
                  size="icon"
                  className="shrink-0 h-8 w-8 sm:h-9 sm:w-9 rounded-[10px] bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-colors duration-300 shadow-none border-none"
                >
                  {isStopping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                </Button>
                <Button 
                  onClick={(e) => { e.stopPropagation(); onResume?.(lab.id); }}
                  size="sm"
                  className="h-8 sm:h-9 rounded-[10px] bg-emerald-500 text-white hover:bg-emerald-600 transition-colors duration-300 shadow-none border-none px-3 font-semibold text-xs"
                >
                  Go To Lab
                </Button>
              </>
            ) : (
              <Button 
                onClick={(e) => { e.stopPropagation(); onStart?.(lab.id); }}
                disabled={isStarting}
                size="icon"
                className="shrink-0 h-8 w-8 sm:h-9 sm:w-9 rounded-[10px] bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-colors duration-300 shadow-none border-none"
              >
                {isStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              </Button>
            )}
          </div>

        </div>
      </div>
    </Card>
  );
}
