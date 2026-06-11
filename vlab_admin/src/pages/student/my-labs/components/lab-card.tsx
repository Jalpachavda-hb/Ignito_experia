import React from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { PlayCircle, Clock, Database, BarChart, FileText, MonitorPlay, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { Lab } from '../types';

interface LabCardProps {
  lab: Lab;
  viewMode?: 'grid' | 'list';
  onStart?: (labId: string) => void;
  onResume?: (labId: string) => void;
  onDetails?: (labId: string) => void;
  onStop?: (labId: string) => void;
  activeSession?: any;
  elapsedTime?: string;
  isStarting?: boolean;
  isStopping?: boolean;
  userCredits?: number;
}

const colorThemes = [
  { text: 'text-red-500', bg: 'bg-red-500', border: 'border-red-500', outline: 'border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30', progress: '[&>div]:bg-red-500' },
  { text: 'text-blue-600', bg: 'bg-blue-600', border: 'border-blue-600', outline: 'border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30', progress: '[&>div]:bg-blue-600' },
  { text: 'text-purple-500', bg: 'bg-purple-500', border: 'border-purple-500', outline: 'border-purple-500 text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950/30', progress: '[&>div]:bg-purple-500' },
  { text: 'text-emerald-500', bg: 'bg-emerald-500', border: 'border-emerald-500', outline: 'border-emerald-500 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30', progress: '[&>div]:bg-emerald-500' },
  { text: 'text-orange-500', bg: 'bg-orange-500', border: 'border-orange-500', outline: 'border-orange-500 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/30', progress: '[&>div]:bg-orange-500' },
];

const getTheme = (idOrName: string) => {
  let hash = 0;
  for (let i = 0; i < idOrName.length; i++) {
    hash = idOrName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colorThemes[Math.abs(hash) % colorThemes.length];
};

export function LabCard({ lab, viewMode = 'grid', onStart, onResume, onStop, onDetails, activeSession, elapsedTime, isStarting, isStopping, userCredits }: LabCardProps) {
  const isRunning = activeSession?.status === 'running' || lab.status === 'active';
  const labStatus = isStarting ? 'Starting...' : isStopping ? 'Stopping...' : isRunning ? 'Running' : lab.status || 'Not Started';
  const progress = labStatus === 'Completed' ? 100 : (isRunning || labStatus === 'In Progress') ? 35 : 0;
  
  const name = lab.title || lab.name || 'Unnamed Lab';
  const imageUrl = lab.logo || lab.image || lab.icon || null;
  const theme = getTheme(lab.id || name);
  
  // List View Layout
  if (viewMode === 'list') {
    return (
      <Card className="flex flex-col sm:flex-row overflow-hidden transition-all duration-300 hover:shadow-lg border-border/60 hover:border-slate-300 group rounded-2xl">
        <div className="w-full sm:w-64 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-center border-b sm:border-b-0 sm:border-r border-border/40 shrink-0 relative overflow-hidden p-6">
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.02)_100%)] dark:bg-[radial-gradient(circle_at_center,transparent_0%,rgba(255,255,255,0.02)_100%)]" />
           <div className="absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:20px_20px] opacity-40" />
           
           {imageUrl ? (
             <img src={imageUrl} alt={name} className="relative z-10 w-full h-full object-contain drop-shadow-sm transition-transform duration-500 group-hover:scale-105" />
           ) : (
             <div className="relative z-10 h-16 w-16 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
               <MonitorPlay className={`h-8 w-8 ${theme.text}`} />
             </div>
           )}
           <div className="absolute top-3 right-3 sm:hidden z-10">
             <div className="bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-full shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-1.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
               <div className={`w-1.5 h-1.5 rounded-full ${theme.bg}`}></div>
               {labStatus}
             </div>
           </div>
        </div>
        
        <div className="flex-1 flex flex-col justify-between p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${theme.text}`}>{lab.category || 'General Lab'}</p>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight">{name}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">
                {lab.description || 'Learn and explore various concepts through this interactive lab environment.'}
              </p>
            </div>
            <div className="hidden sm:block">
              <div className="bg-white dark:bg-slate-900 px-3 py-1.5 rounded-full shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <div className={`w-2 h-2 rounded-full ${theme.bg}`}></div>
                {labStatus}
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-auto text-sm text-slate-500 font-medium">
             <div className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {lab.durationMinutes || lab.duration || 60} Mins</div>
             <div className="flex items-center gap-1.5"><Database className="h-4 w-4" /> {lab.credits || 0} Credits</div>
          </div>
        </div>
        
        <div className="w-full sm:w-64 p-6 border-t sm:border-t-0 sm:border-l border-border/40 flex flex-col justify-center bg-slate-50/50 dark:bg-slate-900/20 shrink-0">
           {(labStatus === 'In Progress' || labStatus === 'active') && (
             <div className="mb-5 w-full">
               <div className="flex justify-between text-xs mb-2 text-slate-500">
                 <span className="font-semibold uppercase tracking-wider">Progress</span>
                 <span className="font-bold text-slate-700 dark:text-slate-300">{progress}%</span>
               </div>
               <Progress value={progress} className={`h-2 bg-slate-200 dark:bg-slate-800 ${theme.progress}`} />
             </div>
           )}
           
           <div className="flex flex-col gap-3 mt-auto w-full">
             {isRunning ? (
               <>
                 <Button onClick={() => onResume?.(lab.id)} className={`w-full ${theme.bg} text-white shadow-sm hover:opacity-90`}>Go To Lab</Button>
                 <Button onClick={() => onStop?.(lab.id)} variant="outline" className={`w-full text-red-500 border-red-200 hover:bg-red-50`} disabled={isStopping}>
                   {isStopping ? 'Stopping...' : 'Stop Lab'}
                 </Button>
               </>
             ) : labStatus === 'Completed' ? (
               <Button onClick={() => onDetails?.(lab.id)} variant="outline" className="w-full border-slate-300">View History</Button>
             ) : (
               <Button 
                 onClick={() => onStart?.(lab.id)} 
                 variant="outline"
                 disabled={isStarting}
                 className={`w-full flex items-center justify-center gap-2 bg-transparent ${theme.outline}`}
               >
                 {isStarting ? (
                   <>
                     <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                     Starting...
                   </>
                 ) : (
                   <>
                     Start Lab
                     <ArrowRight className="w-4 h-4" />
                   </>
                 )}
               </Button>
             )}
             <Button onClick={() => onDetails?.(lab.id)} variant="ghost" className="w-full text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white">
               View Details
             </Button>
           </div>
        </div>
      </Card>
    );
  }

  // Grid View Layout (Default) - Matches the provided screenshot
  return (
    <Card className="flex flex-col h-full overflow-hidden transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.3)] hover:-translate-y-1 border-slate-200/60 dark:border-slate-800 group rounded-[20px] bg-white dark:bg-slate-950">
      <CardHeader className="p-0 relative h-[180px] flex items-center justify-center overflow-hidden shrink-0">
        {/* Subtle background patterns */}
        <div className="absolute inset-0 bg-[#f8fafc] dark:bg-slate-900/50" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.01)_100%)] dark:bg-[radial-gradient(circle_at_center,transparent_0%,rgba(255,255,255,0.02)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:16px_16px] opacity-70" />
        
        {/* Abstract decorative shapes - similar to the screenshot */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-red-100/40 dark:bg-red-900/20 rounded-full blur-3xl opacity-50 transition-opacity duration-500 group-hover:opacity-80" />
        <div className="absolute top-10 -right-10 w-24 h-24 bg-blue-100/40 dark:bg-blue-900/20 rounded-full blur-2xl opacity-50 transition-opacity duration-500 group-hover:opacity-80" />
        
        {imageUrl ? (
           <div className="relative z-10 w-full h-full p-8 flex items-center justify-center">
             <img src={imageUrl} alt={name} className="max-w-[120px] max-h-[120px] object-contain drop-shadow-md transition-transform duration-500 group-hover:scale-110" />
           </div>
        ) : (
           <div className="relative z-10 h-20 w-20 rounded-2xl bg-white dark:bg-slate-800 shadow-[0_4px_20px_rgb(0,0,0,0.05)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.3)] border border-slate-100/50 dark:border-slate-700/50 flex items-center justify-center transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-1">
             <MonitorPlay className={`h-10 w-10 ${theme.text}`} />
           </div>
        )}
        
        <div className="absolute top-4 right-4 z-10">
          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-2.5 py-1 rounded-full shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
            <div className={`w-1.5 h-1.5 rounded-full ${theme.bg}`}></div>
            {labStatus}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="px-5 pt-5 pb-0 flex-1 flex flex-col relative z-20 bg-white dark:bg-slate-950">
        <p className={`text-[10px] font-bold uppercase tracking-[0.15em] mb-2 ${theme.text}`}>
          {lab.category || 'General Lab'}
        </p>
        <h3 className="text-[17px] font-bold text-slate-900 dark:text-white leading-snug mb-2 line-clamp-2" title={name}>
          {name}
        </h3>
        
        <p className="text-[13px] text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed">
          {lab.description || 'Learn and explore various concepts through this interactive lab environment.'}
        </p>

        {isRunning && (
          <div className="mt-auto mb-2 w-full">
            <div className="flex justify-between text-[10px] mb-1.5">
              <span className="font-semibold uppercase text-slate-400 tracking-wider">Elapsed Time</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{elapsedTime || '0:00'}</span>
            </div>
            <Progress value={100} className={`h-1.5 bg-slate-100 dark:bg-slate-800 [&>div]:bg-emerald-500`} />
          </div>
        )}

        {!isRunning && (labStatus === 'In Progress') && (
          <div className="mt-auto mb-2 w-full">
            <div className="flex justify-between text-[10px] mb-1.5">
              <span className="font-semibold uppercase text-slate-400 tracking-wider">Progress</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">{progress}%</span>
            </div>
            <Progress value={progress} className={`h-1.5 bg-slate-100 dark:bg-slate-800 ${theme.progress}`} />
          </div>
        )}
        
        <div className="mt-auto pt-4 border-t border-dashed border-slate-200 dark:border-slate-800/60 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
           <div className="flex items-center gap-1.5 flex-1 justify-center"><Clock className="h-3.5 w-3.5" /> {lab.durationMinutes || lab.duration || 60} Minutes</div>
           <div className="w-[1px] h-3 bg-slate-200 dark:bg-slate-800"></div>
           <div className="flex items-center gap-1.5 flex-1 justify-center"><Database className="h-3.5 w-3.5" /> {lab.credits || 0} Credits</div>
        </div>
      </CardContent>
      
      <CardFooter className="p-5 pt-4 bg-white dark:bg-slate-950 flex flex-col gap-3">
        {isRunning ? (
          <>
            <Button onClick={() => onResume?.(lab.id)} className={`w-full h-11 rounded-[10px] font-semibold shadow-[0_4px_14px_0_rgb(0,0,0,0.1)] text-white ${theme.bg} hover:opacity-90 transition-all duration-200`}>
              Go To Lab
            </Button>
            <Button onClick={() => onStop?.(lab.id)} variant="outline" className={`w-full h-11 rounded-[10px] font-semibold border-red-200 text-red-500 hover:bg-red-50 transition-all duration-200`} disabled={isStopping}>
              {isStopping ? 'Stopping...' : 'Stop Lab'}
            </Button>
          </>
        ) : labStatus === 'Completed' ? (
          <div className="w-full flex gap-3">
            <Button onClick={() => onStart?.(lab.id)} variant="outline" className="flex-1 h-11 rounded-[10px] bg-transparent border-slate-200 dark:border-slate-700" disabled={isStarting}>Restart</Button>
            <Button onClick={() => onDetails?.(lab.id)} className="flex-1 h-11 rounded-[10px] bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-slate-800">History</Button>
          </div>
        ) : (
          <Button 
            onClick={() => onStart?.(lab.id)} 
            variant="outline"
            disabled={isStarting}
            className={`w-full h-11 rounded-[10px] border-[1.5px] flex items-center justify-center gap-2 transition-all duration-200 font-semibold bg-transparent ${theme.outline}`}
          >
            {isStarting ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Starting...
              </>
            ) : (
              <>
                Start Lab
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
