import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Database, MonitorPlay, ChevronRight } from 'lucide-react';
import { Lab } from '../../my-labs/types';

interface SemesterLabCardProps {
  lab: Lab;
  onStart?: (id: string) => void;
}

export function SemesterLabCard({ lab, onStart }: SemesterLabCardProps) {
  const name = lab.title || lab.name || 'Unnamed Lab';
  const imageUrl = lab.logo || lab.image || lab.icon || null;
  const time = lab.durationMinutes || lab.duration || 60;
  const credits = lab.credits || 0;

  return (
    <Card className="flex flex-col h-full bg-white border border-slate-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:shadow-md transition-all duration-300 overflow-hidden rounded-xl">
      <div className="flex-1 p-5 flex flex-col">
        {/* Logo Container */}
        <div className="w-[100px] h-[100px] mx-auto rounded-[20px] bg-slate-50/80 border border-slate-100/80 flex items-center justify-center p-4 mb-5 transition-transform duration-300 hover:scale-105">
          {imageUrl ? (
            <img src={imageUrl} alt={name} className="max-w-full max-h-full object-contain" />
          ) : (
            <MonitorPlay className="w-10 h-10 text-slate-300" />
          )}
        </div>
        
        {/* Details */}
        <h3 className="font-bold text-[15px] text-slate-900 leading-snug mb-4 line-clamp-2" title={name}>
          {name}
        </h3>
        
        <div className="flex items-center gap-2 mt-auto mb-5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>Time: {time}m</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
            <Database className="w-3 h-3 text-slate-400" />
            <span>Credits: {credits}</span>
          </div>
        </div>
        
        {/* Button */}
        <Button 
          onClick={() => onStart?.(lab.id)}
          className="w-full bg-[#df0000] hover:bg-red-700 text-white font-bold h-[42px] rounded-md uppercase tracking-wider text-[12px] shadow-none"
        >
          START LAB <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </Card>
  );
}
