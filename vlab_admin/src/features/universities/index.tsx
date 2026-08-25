import React, { useState } from 'react'
import { Plus, Search as SearchIcon, Mail, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { OnboardUniversityForm } from './OnboardUniversityForm'

const UNIVERSITIES = [
  { id: '1', name: 'Pune Tech University', code: 'PU', email: 'admin@punetech.edu', phone: '+91 98765 43210', students: 4800, status: 'active', mode: 'With LMS', credits: '125,000' },
  { id: '2', name: 'Mumbai Digital Institute', code: 'MU', email: 'contact@mumbaidigital.edu', phone: '+91 98765 43211', students: 3200, status: 'active', mode: 'Without LMS', credits: '78,000' },
  { id: '3', name: 'Bangalore CS Academy', code: 'BA', email: 'info@bangalorecs.edu', phone: '+91 98765 43212', students: 2400, status: 'active', mode: 'With LMS', credits: '95,000' },
  { id: '4', name: 'Delhi Innovation College', code: 'DE', email: 'admin@delhiinnovation.edu', phone: '+91 98765 43213', students: 1800, status: 'inactive', mode: 'Without LMS', credits: '24,000' },
  { id: '5', name: 'Chennai Engineering College', code: 'CH', email: 'dean@chennaiengg.edu', phone: '+91 98765 43214', students: 3100, status: 'active', mode: 'With LMS', credits: '62,000' },
]

export function UniversitiesFeature() {
  const [isOnboarding, setIsOnboarding] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  if (isOnboarding) {
    return <OnboardUniversityForm onBack={() => setIsOnboarding(false)} />
  }

  const filteredUnis = UNIVERSITIES.filter(uni => {
    return uni.name.toLowerCase().includes(searchQuery.toLowerCase()) || uni.email.toLowerCase().includes(searchQuery.toLowerCase())
  })

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground/90">University Management</h1>
          <p className="text-xs text-muted-foreground/80 mt-1 font-normal">
            Manage multi-tenant SaaS university registrations, integration modes, and student allocations.
          </p>
        </div>
        <Button
          onClick={() => setIsOnboarding(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground font-semibold rounded-xl"
        >
          <Plus className="h-4 w-4" />
          Onboard University
        </Button>
      </div>

      <div className="flex items-center justify-between border-b border-border/50 pb-4">
        <div className="relative w-full max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="pl-9 bg-secondary/30 rounded-xl text-xs"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredUnis.map(uni => (
          <div
            key={uni.id}
            className="glass rounded-2xl p-5 border border-border/50 hover:shadow-md hover:border-primary/40 transition-all flex flex-col justify-between h-[210px] bg-card"
          >
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center font-bold text-rose-500 text-xs">
                    {uni.code}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground/90 text-sm line-clamp-1">{uni.name}</h3>
                    <span className={cn(
                      'text-[10px] font-medium px-2 py-0.5 rounded-full inline-block mt-0.5',
                      uni.mode === 'With LMS' ? 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/20' :
                      'bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/20'
                    )}>
                      {uni.mode}
                    </span>
                  </div>
                </div>

                <span className={cn(
                  'h-2 w-2 rounded-full mt-1.5',
                  uni.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                )} />
              </div>

              <div className="mt-4 space-y-1.5 text-xs text-muted-foreground/80">
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground/80" />
                  <span className="truncate">{uni.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground/80" />
                  <span>{uni.phone}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border/50 pt-3 mt-3">
              <div className="text-left">
                <p className="text-[10px] text-muted-foreground/70 uppercase font-semibold tracking-wider">STUDENTS</p>
                <p className="text-sm font-semibold text-foreground/90 mt-0.5">{uni.students}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground/70 uppercase font-semibold tracking-wider">CREDITS</p>
                <p className="text-sm font-semibold text-rose-500 dark:text-rose-400 mt-0.5">{uni.credits}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
