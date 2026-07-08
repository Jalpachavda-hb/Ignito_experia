import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Card, CardContent } from '@/components/ui/card'

import { TransactionsTable } from '@/features/credits/components/transactions-table'
import { Button } from '@/components/ui/button'

export default function TransactionsView() {
  return (
    <>
      <Header>
        <Search />
        <div className='ml-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className="bg-slate-50/50 dark:bg-background">
        <div className='mb-6 flex flex-col items-start justify-between gap-y-4 sm:flex-row sm:items-center'>
          <div>
            <h1 className='text-3xl font-bold tracking-tight'>Transaction Management</h1>
            <p className='text-muted-foreground mt-1'>
              Manage credit transactions, view ledgers, and process refunds.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="bg-background">Bulk Export</Button>
          </div>
        </div>

        {/* Ledger & Tables */}
        <Card className="border-border/50 shadow-sm mb-8 bg-background">
          <CardContent className="p-0">
            <TransactionsTable />
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
