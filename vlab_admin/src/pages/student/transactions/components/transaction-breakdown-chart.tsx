import React, { useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';
import { useTransactionStore } from '@/stores/transactionStore';
import { useAuthStore } from '@/stores/auth-store';
import { useLabTokenStore } from '@/stores/labTokenStore';

interface TransactionBreakdownChartProps {
  transactions?: any[];
  mode?: 'consumed' | 'purchased';
}

function formatLabName(rawName: string): string {
  if (!rawName) return 'Virtual Lab';
  const lower = rawName.toLowerCase().trim();

  if (lower.includes('python')) return 'Python Programming Lab';
  if (lower.includes('java')) return 'Java Development Lab';
  if (lower.includes('linux')) return 'Linux Administration Lab';
  if (lower.includes('oracle')) return 'Oracle Database Lab';
  if (lower.includes('dotnet') || lower.includes('.net')) return 'Web Technology Using .NET';
  if (lower.includes('android') || lower.includes('mobile')) return 'Fundamental of Mobile (Android)';
  if (lower.includes('agile')) return 'Agile Methodology';
  if (lower.includes('big data') || lower.includes('hadoop')) return 'Big Data Analytics-I';
  if (lower.includes('testing') || lower.includes('selenium')) return 'Software Testing Lab';

  return rawName
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getLabColor(rawName: string, index: number = 0): string {
  const lower = String(rawName || '').toLowerCase().trim();
  if (lower.includes('java')) return '#6366f1';        // Indigo
  if (lower.includes('python')) return '#ef4444';      // Red
  if (lower.includes('linux')) return '#0284c7';       // Sky Blue
  if (lower.includes('android') || lower.includes('mobile')) return '#f59e0b'; // Amber
  if (lower.includes('dotnet') || lower.includes('.net')) return '#ec4899';    // Pink
  if (lower.includes('oracle')) return '#8b5cf6';      // Violet
  if (lower.includes('agile')) return '#14b8a6';       // Teal
  if (lower.includes('big data')) return '#3b82f6';    // Blue
  if (lower.includes('testing')) return '#f97316';     // Orange

  const PALETTE = ['#6366f1', '#ef4444', '#0284c7', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6'];
  return PALETTE[index % PALETTE.length];
}

export function TransactionBreakdownChart({ mode = 'consumed' }: TransactionBreakdownChartProps) {
  const { auth } = useAuthStore();
  const { transactions: liveTransactions } = useTransactionStore();
  const { labWallets, fetchStudentLabTokens } = useLabTokenStore();
  const currentStudentEmail = auth?.user?.email?.toLowerCase();

  useEffect(() => {
    fetchStudentLabTokens();
  }, [fetchStudentLabTokens]);

  // Filter ONLY successful/completed transactions for current student
  const successfulTransactions = useMemo(() => {
    return liveTransactions.filter((tx) => {
      const isOwner = !currentStudentEmail || !tx.studentEmail || tx.studentEmail.toLowerCase() === currentStudentEmail;
      const isCompleted = tx.status === 'Completed' || (!tx.status && tx.status !== 'Failed');
      return isOwner && isCompleted;
    });
  }, [liveTransactions, currentStudentEmail]);

  const { data, totalCount } = useMemo(() => {
    const breakdown: Record<string, { value: number; color: string }> = {};

    if (mode === 'consumed') {
      // 1. Consume-mode: calculate real consumed runtime tokens per lab from labWallets
      (labWallets || []).forEach((w, idx) => {
        const used = Number(w.usedTokens || 0);
        if (used > 0) {
          const rawId = String(w.labId || '').toLowerCase().trim();
          const cleanId = rawId.replace(/^lab-/, '').replace(/-lab$/, '');
          const title = formatLabName(cleanId);
          const color = getLabColor(cleanId, idx);

          if (!breakdown[title]) {
            breakdown[title] = { value: 0, color };
          }
          breakdown[title].value += used;
        }
      });
    } else {
      // 2. Purchased-mode: parse itemized labs from transaction orders
      successfulTransactions.forEach((tx: any, tIdx: number) => {
        if (tx.items && Array.isArray(tx.items) && tx.items.length > 0) {
          tx.items.forEach((item: any, iIdx: number) => {
            const name = formatLabName(item.LabId || item.labId || item.labName || 'Virtual Lab');
            const tokens = Number(item.TokenAmount || item.amount || 0);
            const color = getLabColor(name, tIdx + iIdx);
            if (!breakdown[name]) breakdown[name] = { value: 0, color };
            breakdown[name].value += tokens;
          });
        } else if (tx.description && tx.description.toLowerCase().includes('token order')) {
          const desc = tx.description.replace(/^Combined Token Order:\s*/i, '');
          const parts = desc.split(/\s*,\s*/);
          parts.forEach((part: string, pIdx: number) => {
            const match = part.match(/^(.*?)\s*\(\s*(\d+)\s*Tokens?\s*\)$/i);
            if (match) {
              const labName = formatLabName(match[1].trim());
              const tokenCount = Number(match[2]);
              const color = getLabColor(labName, tIdx + pIdx);
              if (!breakdown[labName]) breakdown[labName] = { value: 0, color };
              breakdown[labName].value += tokenCount;
            }
          });
        }
      });

      if (Object.keys(breakdown).length === 0 && labWallets && labWallets.length > 0) {
        labWallets.forEach((w, idx) => {
          const tokens = Number(w.purchasedTokens || 0);
          if (tokens > 0) {
            const title = formatLabName(w.labId);
            const color = getLabColor(w.labId, idx);
            if (!breakdown[title]) breakdown[title] = { value: 0, color };
            breakdown[title].value += tokens;
          }
        });
      }
    }

    const result = Object.entries(breakdown)
      .filter(([_, item]) => item.value > 0)
      .map(([name, item]) => ({ name, value: item.value, color: item.color }));

    const sum = result.reduce((acc, curr) => acc + curr.value, 0);

    return { data: result, totalCount: sum };
  }, [mode, labWallets, successfulTransactions]);

  const COLORS = ['#6366f1', '#ef4444', '#0284c7', '#f59e0b', '#ec4899', '#8b5cf6'];

  return (
    <Card className="border-border/50 shadow-sm h-full rounded-2xl">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <PieChartIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          {mode === 'consumed' ? 'Lab Practice Share & Runtime' : 'Lab Credit Allocation'}
        </CardTitle>
        <CardDescription>
          {mode === 'consumed'
            ? 'Real-time share of runtime tokens consumed per virtual lab.'
            : 'Share of credits allocated per virtual lab module.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="45%"
                  innerRadius={60}
                  outerRadius={82}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => {
                    const numVal = Number(value ?? 0);
                    const pct = totalCount > 0 ? ((numVal / totalCount) * 100).toFixed(1) : '0';
                    return [`${numVal} Tokens (${pct}%)`, String(name)];
                  }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '11px', fontWeight: 600 }}/>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 text-sm border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              <PieChartIcon className="h-8 w-8 text-slate-300 mb-2" />
              <span>{mode === 'consumed' ? 'No practice token usage recorded yet.' : 'No credit distribution data.'}</span>
              <span className="text-xs text-slate-400 mt-1">
                {mode === 'consumed' ? 'Practice in a lab to view runtime consumption share.' : 'Complete a lab top-up to view distribution.'}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
