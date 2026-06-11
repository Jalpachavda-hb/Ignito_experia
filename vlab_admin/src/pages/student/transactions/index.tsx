import React from 'react';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { Button } from '@/components/ui/button';
import { Download, HelpCircle, FileText } from 'lucide-react';
import { dashboardData } from '@/pages/student/dashboard/data';

import { TransactionsHeader } from './components/transactions-header';
import { TransactionTable } from './components/transaction-table';
import { MonthlyActivityChart } from './components/monthly-activity-chart';
import { TransactionBreakdownChart } from './components/transaction-breakdown-chart';
import { LabCreditHistory } from './components/lab-credit-history';
import { AcademicTransactions } from './components/academic-transactions';

export default function Transactions() {
  const { transactions, wallet, recentLabs } = dashboardData;

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
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="hidden sm:flex gap-2">
            <FileText className="h-4 w-4" /> Download Statement
          </Button>
          <Button size="sm" className="gap-2 bg-red-600 hover:bg-red-700 text-white">
            <Download className="h-4 w-4" /> Export Report
          </Button>
        </div>
      </Header>
      
      <Main className="bg-slate-50 dark:bg-slate-950 min-h-[calc(100vh-4rem)] pb-12">
        <div className="w-full p-4 sm:p-6 md:p-8 space-y-8 max-w-[1600px] mx-auto">
          
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
          
          <TransactionsHeader 
            transactions={transactions} 
            totalCredits={wallet.totalCredits} 
          />
          
          <TransactionTable transactions={transactions} />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-6">
              <MonthlyActivityChart data={wallet.consumptionData} />
            </div>
            <div>
              <TransactionBreakdownChart transactions={transactions} />
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <LabCreditHistory recentLabs={recentLabs} />
            <AcademicTransactions />
          </div>

        </div>
      </Main>
    </>
  );
}
