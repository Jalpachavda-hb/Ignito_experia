import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TransactionsTable } from '@/features/credits/components/transactions-table'
import { CreditLedgerTable } from '@/features/credits/components/credit-ledger-table'
import { RefundManagement } from '@/features/credits/components/refund-management'
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
            <Tabs defaultValue="transactions" className="w-full">
              <div className="px-6 border-b border-border bg-muted/10 overflow-x-auto">
                <TabsList className="justify-start rounded-none bg-transparent h-14 p-0 w-max">
                  <TabsTrigger 
                    value="transactions" 
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-6 h-full text-sm font-medium"
                  >
                    Transaction History
                  </TabsTrigger>
                  <TabsTrigger 
                    value="ledger" 
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-6 h-full text-sm font-medium"
                  >
                    Credit Ledger
                  </TabsTrigger>
                  <TabsTrigger 
                    value="refunds" 
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-6 h-full text-sm font-medium"
                  >
                    Refund Management
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="transactions" className="p-0 m-0 border-none outline-none">
                <TransactionsTable />
              </TabsContent>

              <TabsContent value="ledger" className="p-0 m-0 border-none outline-none">
                <CreditLedgerTable />
              </TabsContent>

              <TabsContent value="refunds" className="p-0 m-0 border-none outline-none">
                <RefundManagement />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
