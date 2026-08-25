import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity } from 'lucide-react';
import { useTransactionStore } from '@/stores/transactionStore';
import { useAuthStore } from '@/stores/auth-store';
import { useLabTokenStore } from '@/stores/labTokenStore';

interface MonthlyActivityChartProps {
  data?: { name: string; value: number }[];
}

export function MonthlyActivityChart({}: MonthlyActivityChartProps) {
  const { auth } = useAuthStore();
  const { transactions } = useTransactionStore();
  const { summary, labWallets } = useLabTokenStore();
  const currentStudentEmail = auth?.user?.email?.toLowerCase();

  // Filter ONLY successful/completed transactions for the current student
  const successfulTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const isOwner = !currentStudentEmail || !tx.studentEmail || tx.studentEmail.toLowerCase() === currentStudentEmail;
      const isCompleted = tx.status === 'Completed' || (!tx.status && tx.status !== 'Failed');
      return isOwner && isCompleted;
    });
  }, [transactions, currentStudentEmail]);

  // Defined Lab Color Palette
  const LAB_COLOR_CONFIG: Array<{ key: string; name: string; color: string }> = [
    { key: 'java', name: 'Java Development Lab', color: '#6366f1' },       // Indigo
    { key: 'python', name: 'Python Programming Lab', color: '#ef4444' },    // Red/Rose
    { key: 'linux', name: 'Linux Administration Lab', color: '#0284c7' },   // Sky Blue
    { key: 'android', name: 'Android Application Lab', color: '#f59e0b' },  // Amber
    { key: 'dotnet', name: '.NET Technologies Lab', color: '#ec4899' },     // Pink
  ];

  const { chartData, activeLabConfig } = useMemo(() => {
    const now = new Date();
    const currentMonthKey = now.toLocaleString('en-US', { month: 'short' });
    const monthNames: string[] = [];
    const monthMap: Record<string, Record<string, number>> = {};

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mName = d.toLocaleString('en-US', { month: 'short' });
      monthNames.push(mName);
      monthMap[mName] = { 'Credits Added': 0 };
    }

    const dynamicLabList = [...LAB_COLOR_CONFIG];

    // Initialize 0 for all labs across months
    monthNames.forEach((m) => {
      dynamicLabList.forEach((l) => {
        monthMap[m][l.name] = 0;
      });
    });

    // Map labWallets to lab consumption
    (labWallets || []).forEach((w) => {
      const used = Number(w.usedTokens || 0);
      const rawId = String(w.labId || '').toLowerCase().trim();
      const cleanId = rawId.replace(/^lab-/, '').replace(/-lab$/, '');

      let matchedLab = dynamicLabList.find((l) => cleanId.includes(l.key));
      if (!matchedLab) {
        const customName = `${rawId.toUpperCase()} Lab`;
        matchedLab = { key: cleanId, name: customName, color: '#8b5cf6' };
        if (!dynamicLabList.some((l) => l.name === customName)) {
          dynamicLabList.push(matchedLab);
        }
      }

      if (used > 0) {
        monthMap[currentMonthKey][matchedLab.name] = (monthMap[currentMonthKey][matchedLab.name] || 0) + used;
      }
    });

    // Populate purchased credits from successful transactions
    successfulTransactions.forEach((tx) => {
      if (!tx.date) return;
      const txDate = new Date(tx.date);
      const mName = txDate.toLocaleString('en-US', { month: 'short' });
      if (monthMap[mName] && (tx.type === 'Credit' || (tx.type as string) === 'Token' || !tx.type)) {
        monthMap[mName]['Credits Added'] += Number(tx.amount) || 0;
      }
    });

    if (summary && summary.totalPurchased > 0) {
      monthMap[currentMonthKey]['Credits Added'] = Math.max(monthMap[currentMonthKey]['Credits Added'], summary.totalPurchased);
    }

    // Determine active labs with usage > 0 (or default top 2 if zero usage)
    const usedLabs = dynamicLabList.filter((l) => {
      return monthNames.some((m) => (monthMap[m][l.name] || 0) > 0);
    });

    const activeLabConfig = usedLabs.length > 0 ? usedLabs : dynamicLabList.slice(0, 2);

    const chartData = monthNames.map((m) => ({
      name: m,
      ...monthMap[m],
    }));

    return { chartData, activeLabConfig };
  }, [labWallets, successfulTransactions, summary]);

  const hasData = chartData.some((item) => {
    return Object.entries(item).some(([k, v]) => k !== 'name' && Number(v) > 0);
  });

  return (
    <Card className="border-border/50 shadow-sm rounded-2xl">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Activity className="h-5 w-5 text-indigo-500" /> Lab-Wise Token Consumption & Activity
        </CardTitle>
        <CardDescription>
          Real-time credit consumption lines per virtual lab environment vs. total credits added.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[320px] w-full">
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorAdded" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>

                  {activeLabConfig.map((lab) => (
                    <linearGradient key={`grad-${lab.key}`} id={`grad-${lab.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={lab.color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={lab.color} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
                </defs>

                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                
                <Tooltip
                  formatter={(value, name) => [`${Number(value ?? 0)} Tokens`, String(name)]}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                />
                
                <Legend
                  layout="horizontal"
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ fontSize: '11px', fontWeight: 600, paddingBottom: '12px' }}
                />

                {/* Total Credits Added Line */}
                <Area
                  type="monotone"
                  dataKey="Credits Added"
                  name="Credits Added"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fillOpacity={1}
                  fill="url(#colorAdded)"
                />

                {/* Lab-Specific Consumed Lines with Distinct Vibrant Colors */}
                {activeLabConfig.map((lab) => (
                  <Area
                    key={lab.key}
                    type="monotone"
                    dataKey={lab.name}
                    name={lab.name}
                    stroke={lab.color}
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill={`url(#grad-${lab.key})`}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 text-sm border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              <Activity className="h-8 w-8 text-slate-300 mb-2" />
              <span>No lab token consumption activity recorded yet.</span>
              <span className="text-xs text-slate-400 mt-1">Start a virtual lab session to view live consumption curves.</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
