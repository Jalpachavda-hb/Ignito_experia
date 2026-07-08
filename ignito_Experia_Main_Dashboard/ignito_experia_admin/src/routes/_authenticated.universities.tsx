import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Building2, Plus, Search as SearchIcon, Filter, Mail, Phone, GraduationCap, Users2, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Sheet, SheetContent } from '@/components/ui/sheet'

export const Route = createFileRoute('/_authenticated/universities')({
  component: UniversitiesPage,
})

const UNIVERSITIES = [
  { id: '1', name: 'Pune Tech University', logo: '', email: 'admin@punetech.edu', phone: '+91 98765 43210', students: 4800, status: 'active', plan: 'enterprise', credits: 125000 },
  { id: '2', name: 'Mumbai Digital Institute', logo: '', email: 'contact@mumbaidigital.edu', phone: '+91 98765 43211', students: 3200, status: 'active', plan: 'standard', credits: 78000 },
  { id: '3', name: 'Bangalore CS Academy', logo: '', email: 'info@bangalorecs.edu', phone: '+91 98765 43212', students: 2400, status: 'active', plan: 'enterprise', credits: 95000 },
  { id: '4', name: 'Delhi Innovation College', logo: '', email: 'admin@delhiinnovation.edu', phone: '+91 98765 43213', students: 1800, status: 'inactive', plan: 'basic', credits: 24000 },
  { id: '5', name: 'Chennai Engineering College', logo: '', email: 'dean@chennaiengg.edu', phone: '+91 98765 43214', students: 3100, status: 'active', plan: 'standard', credits: 62000 },
]

const UNIVERSITY_DETAILS: Record<string, any> = {
  '1': {
    programs: [
      {
        name: 'Master of Computer Applications (MCA)',
        semesters: [
          { name: 'Semester 1', labs: ['Python Programming Lab', 'DBMS Lab'] },
          { name: 'Semester 2', labs: ['Java & OOP Lab', 'Data Structures Lab'] },
        ]
      },
      {
        name: 'B.Tech in Computer Science',
        semesters: [
          { name: 'Semester 3', labs: ['Operating Systems Lab', 'Computer Networks Lab'] },
          { name: 'Semester 5', labs: ['Web Technologies Lab', 'Cloud Computing Lab'] },
        ]
      }
    ]
  },
  '2': {
    programs: [
      {
        name: 'M.Tech in Data Science',
        semesters: [
          { name: 'Semester 1', labs: ['Data Visualization Lab', 'Machine Learning Lab'] }
        ]
      }
    ]
  }
}

export default function UniversitiesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPlan, setFilterPlan] = useState('all')
  const [selectedUni, setSelectedUni] = useState<typeof UNIVERSITIES[0] | null>(null)

  const filteredUnis = UNIVERSITIES.filter(uni => {
    const matchesSearch = uni.name.toLowerCase().includes(searchQuery.toLowerCase()) || uni.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesPlan = filterPlan === 'all' || uni.plan === filterPlan
    return matchesSearch && matchesPlan
  })

  return (
    <>
      <Header>
        <Search />
        <div className='ml-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main>
        <div className="space-y-6 relative min-h-[calc(100vh-8rem)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">University Management</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage SaaS customer registrations, credit balance, subscriptions, and active program configurations.
              </p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 active:scale-98 transition-all">
              <Plus className="h-4 w-4" />
              Onboard University
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-4">
            <div className="relative w-full max-w-sm">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={filterPlan}
                onChange={e => setFilterPlan(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-secondary border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 appearance-none pr-8 relative"
              >
                <option value="all">All Plans</option>
                <option value="enterprise">Enterprise</option>
                <option value="standard">Standard</option>
                <option value="basic">Basic</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUnis.map(uni => (
              <div
                key={uni.id}
                onClick={() => setSelectedUni(uni)}
                className="glass rounded-2xl p-5 border border-border hover:border-primary/30 transition-all cursor-pointer flex flex-col justify-between h-[200px]"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-sm">
                        {uni.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground text-sm line-clamp-1">{uni.name}</h3>
                        <span className={cn(
                          'text-[9px] font-bold px-2 py-0.5 rounded-full capitalize',
                          uni.plan === 'enterprise' ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20' :
                          uni.plan === 'standard' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                          'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        )}>
                          {uni.plan} Plan
                        </span>
                      </div>
                    </div>

                    <span className={cn(
                      'h-2 w-2 rounded-full',
                      uni.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground'
                    )} />
                  </div>

                  <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5" />
                      <span className="truncate">{uni.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{uni.phone}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border/50 pt-3 mt-3">
                  <div className="text-left">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Students</p>
                    <p className="text-sm font-bold text-foreground mt-0.5">{uni.students}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Credits</p>
                    <p className="text-sm font-bold text-primary mt-0.5">{uni.credits.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Sheet open={!!selectedUni} onOpenChange={(open) => !open && setSelectedUni(null)}>
            <SheetContent className="w-full sm:max-w-lg overflow-y-auto flex flex-col p-0 border-l border-border bg-background">
              {selectedUni && (
                <>
                  <div className="flex items-center justify-between p-6 border-b border-border">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary">
                        {selectedUni.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-foreground">{selectedUni.name}</h2>
                        <p className="text-xs text-muted-foreground">{selectedUni.email}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="glass rounded-xl p-4 border border-border">
                        <GraduationCap className="h-5 w-5 text-primary mb-1" />
                        <p className="text-lg font-bold text-foreground">{selectedUni.students}</p>
                        <p className="text-xs text-muted-foreground">Active Students</p>
                      </div>
                      <div className="glass rounded-xl p-4 border border-border">
                        <Users2 className="h-5 w-5 text-violet-400 mb-1" />
                        <p className="text-lg font-bold text-foreground">{selectedUni.credits.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Credit Balance</p>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Academic Programs & Lab Assignments</h3>
                      {UNIVERSITY_DETAILS[selectedUni.id] ? (
                        <div className="space-y-4">
                          {UNIVERSITY_DETAILS[selectedUni.id].programs.map((prog: any, pi: number) => (
                            <div key={pi} className="glass rounded-xl border border-border p-4 space-y-3">
                              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                                {prog.name}
                              </h4>
                              <div className="pl-3 space-y-2 border-l border-border/50">
                                {prog.semesters.map((sem: any, si: number) => (
                                  <div key={si} className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground">{sem.name}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {sem.labs.map((lab: string, li: number) => (
                                        <span key={li} className="px-2 py-0.5 rounded bg-secondary text-[10px] text-foreground border border-border/40">
                                          {lab}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center p-8 rounded-xl bg-secondary/30 border border-dashed border-border gap-2 text-center">
                          <ShieldAlert className="h-5 w-5 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">No program/semester configuration synced for this university yet.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </Main>
    </>
  )
}
