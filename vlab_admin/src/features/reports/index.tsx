import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ReportsFilters } from './components/reports-filters'
import { ReportsCharts } from './components/reports-charts'
import { ReportsTables } from './components/reports-tables'

export default function ReportsView() {
  return (
    <>
      <Header>
        <Search />
        <div className='ml-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>
      
      <Main className="bg-muted/10 pb-8">
        <div className='mb-6'>
          <h1 className='text-3xl font-bold tracking-tight'>Reports & Analytics</h1>
          <p className='text-muted-foreground mt-1'>
            Comprehensive insights into compute usage, active sessions, and student allocations.
          </p>
        </div>

        {/* Global Filters and Export Bar */}
        <ReportsFilters />

        {/* Analytics Charts */}
        <ReportsCharts />

        {/* Tabular Reports Data */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Detailed Reports Data</h2>
          <ReportsTables />
        </div>
        
      </Main>
    </>
  )
}
