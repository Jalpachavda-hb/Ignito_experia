import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Database, TrendingDown, ArrowUpRight, Wallet, Activity, Clock, XCircle, Undo2, BellRing } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { WalletsTable } from './components/wallets-table'
import { CreditAnalytics } from './components/credit-analytics'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useEffect } from 'react'

export default function CreditsView() {
  
  // Simulate system alerts for notifications requirement
  useEffect(() => {
    const timer = setTimeout(() => {
      toast('System Alert: Low Credit Balance', {
        description: 'User Alex Johnson is running low on credits (Balance: 120)',
        icon: <BellRing className="text-amber-500 h-4 w-4" />,
      })
    }, 3000)
    return () => clearTimeout(timer)
  }, [])

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
            <h1 className='text-3xl font-bold tracking-tight'>Credit Accounting</h1>
            <p className='text-muted-foreground mt-1'>
              Enterprise financial analytics and active credit pool tracking.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="bg-background">Bulk Allocation</Button>
            <Button variant="outline" className="bg-background">Bulk Export</Button>
          </div>
        </div>

        {/* 8 KPI Cards as requested */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6'>
          
          <Card className="border-border/50 shadow-sm bg-background">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Credit Pool</CardTitle>
              <Database className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,000,000</div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <ArrowUpRight className="h-3 w-3 text-emerald-500 mr-1" />
                <span className="text-emerald-500 font-medium">0.0%</span> from yesterday
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm bg-background">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Allocated</CardTitle>
              <ArrowUpRight className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">120,450</div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <ArrowUpRight className="h-3 w-3 text-emerald-500 mr-1" />
                <span className="text-emerald-500 font-medium">+12.5%</span> from last month
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm bg-background">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Consumed</CardTitle>
              <TrendingDown className="h-4 w-4 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">45,231</div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <TrendingDown className="h-3 w-3 text-rose-500 mr-1" />
                <span className="text-rose-500 font-medium">+8.2%</span> burn rate
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm bg-background">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Refunded</CardTitle>
              <Undo2 className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">1,250</div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <ArrowUpRight className="h-3 w-3 text-amber-500 mr-1" />
                <span className="text-amber-500 font-medium">+2.1%</span> dispute rate
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm bg-background">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              <Activity className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12,845</div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                Lifetime operations logged
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm bg-background">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Volume</CardTitle>
              <Wallet className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">342</div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <ArrowUpRight className="h-3 w-3 text-emerald-500 mr-1" />
                <span className="text-emerald-500 font-medium">+15%</span> vs yesterday
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm bg-background">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Processing</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">18</div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                Awaiting final confirmation
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm bg-background">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed / Reversed</CardTitle>
              <XCircle className="h-4 w-4 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">42</div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <TrendingDown className="h-3 w-3 text-emerald-500 mr-1" />
                <span className="text-emerald-500 font-medium">-2%</span> failure rate
              </p>
            </CardContent>
          </Card>

        </div>

        <Card className="border-border/50 shadow-sm mb-8 bg-background">
          <CardContent className="p-0">
            <Tabs defaultValue="analytics" className="w-full">
              <div className="px-6 border-b border-border bg-muted/10 overflow-x-auto">
                <TabsList className="justify-start rounded-none bg-transparent h-14 p-0 w-max">
                  <TabsTrigger 
                    value="analytics" 
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-6 h-full text-sm font-medium"
                  >
                    Consumption Analytics
                  </TabsTrigger>
                  <TabsTrigger 
                    value="wallets" 
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-6 h-full text-sm font-medium text-muted-foreground"
                  >
                    Wallets Overview
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="analytics" className="p-0 m-0 border-none outline-none">
                <CreditAnalytics />
              </TabsContent>
              
              <TabsContent value="wallets" className="p-0 m-0 border-none outline-none">
                <WalletsTable />
              </TabsContent>
              
            </Tabs>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
