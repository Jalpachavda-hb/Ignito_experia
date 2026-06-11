import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';
import { Transaction } from '@/pages/student/dashboard/types';

interface TransactionBreakdownChartProps {
  transactions: Transaction[];
}

export function TransactionBreakdownChart({ transactions }: TransactionBreakdownChartProps) {
  // Aggregate transaction types
  const breakdown = {
    'Lab Launch': 0,
    'Semester Allocation': 0,
    'Bonus / Reward': 0,
  };

  transactions.forEach(tx => {
    if (tx.description.includes('Lab')) {
      if (tx.type === 'Debit') breakdown['Lab Launch'] += tx.amount;
      else breakdown['Bonus / Reward'] += tx.amount;
    } else if (tx.description.includes('Semester') || tx.description.includes('Allocation')) {
      breakdown['Semester Allocation'] += tx.amount;
    } else {
      breakdown['Bonus / Reward'] += tx.amount;
    }
  });

  const data = Object.entries(breakdown)
    .filter(([_, value]) => value > 0)
    .map(([name, value]) => ({ name, value }));

  const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

  return (
    <Card className="border-border/50 shadow-sm h-full">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <PieChartIcon className="h-5 w-5 text-rose-500" /> Transaction Breakdown
        </CardTitle>
        <CardDescription>Volume of credits by transaction category.</CardDescription>
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
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [`${value} Credits`, 'Volume']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '12px' }}/>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full flex items-center justify-center text-slate-500 text-sm">
              No transaction data available
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
