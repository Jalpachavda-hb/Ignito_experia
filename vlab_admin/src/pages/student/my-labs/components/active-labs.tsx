import React from 'react';
import { PlayCircle, Clock, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Lab } from '../types';

interface ActiveLabsProps {
  labs: Lab[];
  onResume: (labId: string) => void;
}

export function ActiveLabs({ labs, onResume }: ActiveLabsProps) {
  if (!labs || labs.length === 0) return null;

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <PlayCircle className="h-5 w-5 text-red-500" />
          Continue Where You Left Off
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {labs.slice(0, 3).map((lab) => {
          // For display purposes, assume an arbitrary progress if it's active
          const progress = 45; 
          const name = lab.title || lab.name || 'Active Lab Session';

          return (
            <Card key={lab.id} className="border-red-500/20 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
              {/* Subtle animated background gradient for active labs */}
              <div className="absolute inset-0 bg-gradient-to-br from-red-50/50 via-white to-orange-50/30 dark:from-red-950/20 dark:via-background dark:to-orange-950/10 pointer-events-none"></div>
              
              <CardContent className="p-5 relative z-10 flex flex-col h-full justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
                      Running Session
                    </p>
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Started 2h ago
                    </span>
                  </div>
                  
                  <h3 className="text-base font-bold text-foreground leading-tight mb-4 line-clamp-2">
                    {name}
                  </h3>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] mb-1.5 font-medium">
                    <span className="text-muted-foreground">Session Time Remaining</span>
                    <span className="text-foreground">1h 15m</span>
                  </div>
                  <Progress value={progress} className="h-1.5 bg-slate-100 dark:bg-slate-800 mb-4">
                    <div 
                      className="h-full bg-red-500 rounded-full" 
                      style={{ width: `${progress}%` }}
                    />
                  </Progress>
                  
                  <Button 
                    onClick={() => onResume(lab.id)} 
                    className="w-full bg-slate-900 dark:bg-slate-50 hover:bg-red-600 dark:hover:bg-red-600 text-slate-50 dark:text-slate-900 hover:text-white dark:hover:text-white transition-colors group-hover:bg-red-600 group-hover:text-white"
                  >
                    Quick Resume <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
