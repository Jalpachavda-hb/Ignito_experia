import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { DashboardData } from '@/pages/student/dashboard/types';
import { Award, Calendar, CheckCircle2, Download, ExternalLink, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface FeaturedCertificateProps {
  data: DashboardData;
}

export function FeaturedCertificate({ data }: FeaturedCertificateProps) {
  const { certificates, student } = data;
  
  // Pick the most recent/important certificate
  const featured = certificates[0] || null;

  if (!featured) return null;

  return (
    <Card className="border-border/50 shadow-sm overflow-hidden relative bg-white dark:bg-slate-950">
      {/* Abstract Background Design */}
      <div className="absolute inset-0 z-0 opacity-40">
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl" style={{ backgroundColor: '#fcdadb' }}></div>
        <div className="absolute bottom-0 left-10 w-48 h-48 rounded-full blur-3xl" style={{ backgroundColor: '#fcdadb' }}></div>
      </div>
      
      <CardContent className="p-6 md:p-8 relative z-10">
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
          
          {/* Certificate Thumbnail Preview */}
          <div className="w-full md:w-1/3 aspect-[4/3] rounded-lg bg-white/60 dark:bg-slate-900/60 border border-rose-100 dark:border-slate-800 flex flex-col items-center justify-center p-4 shadow-sm backdrop-blur-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-white/80 to-white/20 dark:from-slate-900/80 dark:to-slate-900/20 z-0"></div>
            <Award className="h-16 w-16 text-rose-500 mb-4 relative z-10" />
            <h3 className="text-center font-serif text-lg font-bold leading-tight relative z-10 text-slate-900 dark:text-white">{featured.title}</h3>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mt-2 relative z-10">{student.name}</p>
            <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-20">
              <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full bg-rose-100 text-rose-700 hover:bg-rose-200">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Certificate Details */}
          <div className="w-full md:w-2/3 space-y-5">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Badge className="text-rose-700 hover:bg-rose-200 border-none" style={{ backgroundColor: '#fcdadb' }}>Featured Achievement</Badge>
                <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/30 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3" /> {featured.status}
                </Badge>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{featured.title}</h2>
              <p className="text-slate-500 mt-2 text-sm">{featured.program}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4 border-y border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" /> Issued Date
                </p>
                <p className="font-semibold text-sm text-slate-900 dark:text-white">{new Date(featured.issueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                  <Award className="h-3 w-3" /> Issued By
                </p>
                <p className="font-semibold text-sm text-slate-900 dark:text-white">{featured.issuedBy}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="h-3 w-3" /> Credential ID
                </p>
                <p className="font-mono font-medium text-xs text-rose-600 dark:text-rose-400">{featured.certificateId}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 flex items-center gap-2">
                <ExternalLink className="h-4 w-4" /> View Certificate
              </Button>
              <Button variant="outline" className="border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 flex items-center gap-2">
                <Download className="h-4 w-4" /> Download PDF
              </Button>
            </div>
          </div>
          
        </div>
      </CardContent>
    </Card>
  );
}
