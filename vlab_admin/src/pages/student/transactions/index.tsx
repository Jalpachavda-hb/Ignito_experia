import React, { useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { Button } from '@/components/ui/button';
import { Download, HelpCircle, FileText } from 'lucide-react';
import { useTransactionStore } from '@/stores/transactionStore';
import { useLabStore } from '@/stores/labStore';
import { useLabTokenStore } from '@/stores/labTokenStore';

import { TransactionsHeader } from './components/transactions-header';
import { TransactionTable } from './components/transaction-table';
import { MonthlyActivityChart } from './components/monthly-activity-chart';
import { TransactionBreakdownChart } from './components/transaction-breakdown-chart';
import { LabCreditHistory } from './components/lab-credit-history';

export default function Transactions() {
  const { transactions, fetchTransactions } = useTransactionStore();
  const { labs, loadLabs } = useLabStore();
  const { fetchStudentLabTokens } = useLabTokenStore();

  useEffect(() => {
    fetchTransactions();
    loadLabs();
    fetchStudentLabTokens();
  }, [fetchTransactions, loadLabs, fetchStudentLabTokens]);

  return (
    <>
      <Header className="justify-between bg-white dark:bg-card border-b border-border/40 px-6 h-16 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground font-medium">
            <span>Dashboard</span>
            <span className="text-border">/</span>
            <span className="text-slate-900 dark:text-white font-semibold">Transactions</span>
          </div>
        </div>
      </Header>
      
      <Main className="bg-slate-50 dark:bg-slate-950 min-h-[calc(100vh-4rem)] pb-12">
        <div className="w-full px-4 md:px-6 xl:px-10 py-6 space-y-6 max-w-[1600px] mx-auto">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Transaction History</h1>
              <p className="text-slate-500 mt-1.5 max-w-2xl">
                Track all credit-related activities including lab launches, allocations, purchases, and rewards.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-slate-600">
                <HelpCircle className="h-4 w-4 mr-2" /> Support
              </Button>
            </div>
          </div>
          
          <TransactionsHeader />
          
          <TransactionTable transactions={transactions} />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-6">
              <MonthlyActivityChart />
            </div>
            <div>
              <TransactionBreakdownChart mode="purchased" transactions={transactions} />
            </div>
          </div>

          <div className="w-full">
            <LabCreditHistory recentLabs={labs.slice(0, 5)} />
          </div>

        </div>
      </Main>
    </>
  );
}
