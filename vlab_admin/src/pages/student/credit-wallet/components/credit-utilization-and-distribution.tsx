import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { PieChart as PieChartIcon } from 'lucide-react';

interface LabActivity {
  labName: string;
  creditsUsed: number;
}

interface CreditUtilizationProps {
  totalCredits: number;
  usedCredits: number;
  recentLabs: LabActivity[];
}

export function CreditUtilizationAndDistribution({ totalCredits, usedCredits, recentLabs }: CreditUtilizationProps) {
  const utilization = totalCredits > 0 ? Math.round((usedCredits / totalCredits) * 100) : 0;
  
  // Transform labs data for pie chart
  const data = recentLabs
    .filter(lab => lab.creditsUsed > 0)
    .map(lab => ({
      name: lab.labName.length > 18 ? lab.labName.substring(0, 18) + '...' : lab.labName,
      value: lab.creditsUsed
    }));

  const COLORS = ['#ef4444', '#f97316', '#10b981', '#f59e0b', '#8b5cf6', '#64748b'];

  return (
    <Card className="border-border/50 shadow-sm h-full">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
          <PieChartIcon className="h-5 w-5 text-red-500" /> Credit Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <div className="flex justify-between items-center text-sm font-semibold mb-2">
            <span className="text-slate-600 dark:text-slate-400">Total Utilization</span>
            <span className="text-slate-900 dark:text-white">{usedCredits} / {totalCredits} ({utilization}%)</span>
          </div>
          <Progress value={utilization} className={`h-2.5 bg-slate-100 dark:bg-slate-800 ${utilization > 85 ? '[&>div]:bg-red-500' : '[&>div]:bg-red-500'}`} />
        </div>

        {data.length > 0 ? (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="45%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  formatter={(value: number) => [`${value} Credits`, 'Used']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[250px] flex items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
            <p className="text-sm text-slate-500">No credit usage data available yet.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
