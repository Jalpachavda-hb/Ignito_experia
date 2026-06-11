import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { DashboardData } from '@/pages/student/dashboard/types';
import { Award, Download, MoreVertical, Eye, Printer, Share2, ShieldCheck, CalendarDays } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CertificateGalleryProps {
  data: DashboardData;
}

export function CertificateGallery({ data }: CertificateGalleryProps) {
  const { certificates } = data;

  if (!certificates || certificates.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Award className="h-5 w-5 text-indigo-500" /> Earned Certificates
          </h2>
          <p className="text-sm text-slate-500 font-medium">All your official credentials and academic certificates.</p>
        </div>
        <Badge variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {certificates.length} Total
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {certificates.map((cert) => (
          <Card key={cert.id} className="border-border/50 shadow-sm overflow-hidden flex flex-col group hover:shadow-md transition-all duration-200">
            {/* Thumbnail Preview Area */}
            <div className="h-40 bg-slate-100 dark:bg-slate-900 relative border-b border-border/40 flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-slate-200/50 to-white/50 dark:from-slate-800/50 dark:to-slate-800/20 z-0"></div>

              {/* Fake Certificate Document Design */}
              <div className="w-[80%] h-[80%] bg-white dark:bg-slate-950 shadow-sm border border-slate-200 dark:border-slate-800 p-3 flex flex-col items-center justify-center relative z-10">
                <div className="absolute inset-1 border border-double border-slate-200 dark:border-slate-800 pointer-events-none"></div>
                <Award className="h-6 w-6 text-indigo-400/50 mb-2" />
                <div className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded mb-1"></div>
                <div className="w-3/4 h-1 bg-slate-200 dark:bg-slate-800 rounded mb-3"></div>
                <div className="w-1/2 h-1 bg-rose-200 dark:bg-rose-900/50 rounded"></div>
              </div>

              {/* Status Badge */}
              <div className="absolute top-3 left-3 z-20">
                <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider ${cert.status === 'Verified' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900' :
                    cert.status === 'Issued' ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900' :
                      'bg-slate-50 text-slate-500 border-slate-200'
                  }`}>
                  {cert.status}
                </Badge>
              </div>

              {/* Type Badge */}
              <div className="absolute top-3 right-3 z-20">
                <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider bg-white/80 dark:bg-slate-950/80 backdrop-blur text-slate-600 dark:text-slate-300">
                  {cert.type}
                </Badge>
              </div>
            </div>

            <CardContent className="p-5 flex-1 flex flex-col">
              <h3 className="font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug">{cert.title}</h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-1">{cert.program}</p>

              <div className="mt-4 space-y-2 flex-1">
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>Issued: {new Date(cert.issueDate).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span className="font-mono text-[11px]">{cert.certificateId}</span>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <Button size="sm" variant="outline" className="text-xs gap-1.5 h-8">
                  <Download className="h-3.5 w-3.5" /> PDF
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:hover:text-white">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem className="text-xs cursor-pointer">
                      <Eye className="h-3.5 w-3.5 mr-2 text-slate-500" /> View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-xs cursor-pointer">
                      <Download className="h-3.5 w-3.5 mr-2 text-slate-500" /> Download PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-xs cursor-pointer">
                      <Printer className="h-3.5 w-3.5 mr-2 text-slate-500" /> Print Certificate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-xs cursor-pointer">
                      <Share2 className="h-3.5 w-3.5 mr-2 text-slate-500" /> Share on LinkedIn
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-xs cursor-pointer">
                      <ShieldCheck className="h-3.5 w-3.5 mr-2 text-emerald-500" /> Verify Authenticity
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
