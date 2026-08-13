import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Plus, Search as SearchIcon, Mail, Phone, ArrowLeft, Building2, User, Key, CheckCircle2, GraduationCap, Cpu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const UNIVERSITIES = [
  { id: '1', name: 'Pune Tech University', code: 'PU', email: 'admin@punetech.edu', phone: '+91 98765 43210', students: 4800, status: 'active', mode: 'With LMS', credits: '125,000' },
  { id: '2', name: 'Mumbai Digital Institute', code: 'MU', email: 'contact@mumbaidigital.edu', phone: '+91 98765 43211', students: 3200, status: 'active', mode: 'Without LMS', credits: '78,000' },
  { id: '3', name: 'Bangalore CS Academy', code: 'BA', email: 'info@bangalorecs.edu', phone: '+91 98765 43212', students: 2400, status: 'active', mode: 'With LMS', credits: '95,000' },
  { id: '4', name: 'Delhi Innovation College', code: 'DE', email: 'admin@delhiinnovation.edu', phone: '+91 98765 43213', students: 1800, status: 'inactive', mode: 'Without LMS', credits: '24,000' },
  { id: '5', name: 'Chennai Engineering College', code: 'CH', email: 'dean@chennaiengg.edu', phone: '+91 98765 43214', students: 3100, status: 'active', mode: 'With LMS', credits: '62,000' },
]

function UniversitiesPage() {
  const [isOnboarding, setIsOnboarding] = useState(false)
  const [onboardingMode, setOnboardingMode] = useState<'lms' | 'individual'>('lms')
  const [searchQuery, setSearchQuery] = useState('')

  const [submitted, setSubmitted] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    domain: '',
    adminName: '',
    adminEmail: '',
    adminPhone: '',
  })

  const handleNameChange = (nameVal: string) => {
    const autoSlug = nameVal.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15)
    setFormData({
      ...formData,
      name: nameVal,
      slug: autoSlug,
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setTimeout(() => {
      setSubmitted(false)
      setIsOnboarding(false)
    }, 1500)
  }

  const filteredUnis = UNIVERSITIES.filter(uni => {
    return uni.name.toLowerCase().includes(searchQuery.toLowerCase()) || uni.email.toLowerCase().includes(searchQuery.toLowerCase())
  })

  return (
    <>
      <Header>
        <Search />
        <div className="ml-auto flex items-center space-x-4">
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className="bg-[#fcfcfc] dark:bg-background min-h-[calc(100vh-3.5rem)]">
        <div className="space-y-6 max-w-[1600px] mx-auto py-6 px-4 sm:px-6">
          {isOnboarding ? (
            <div className="w-full space-y-6 py-2">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsOnboarding(false)}
                  className="h-9 w-9 rounded-xl border-border/60 hover:bg-secondary"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground/90">Onboard New University (Tenant)</h1>
                  <p className="text-xs text-muted-foreground/80 mt-0.5 font-normal">
                    Configure multi-tenant SaaS profile, select LMS or Individual mode, and set administrator credentials.
                  </p>
                </div>
              </div>

              {submitted ? (
                <div className="glass rounded-2xl p-12 border border-emerald-500/30 text-center space-y-4 bg-emerald-500/5">
                  <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto animate-bounce" />
                  <h2 className="text-2xl font-bold text-foreground">University Tenant Provisioned Successfully!</h2>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    {formData.name || 'New University'} has been onboarded in {onboardingMode === 'lms' ? 'With LMS Integration' : 'Without LMS (Individual)'} mode. Redirecting to university list...
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Section 1: University Profile */}
                  <div className="glass rounded-2xl p-6 border border-border/50 shadow-sm space-y-4 bg-card w-full">
                    <div className="flex items-center gap-2 border-b border-border/50 pb-3">
                      <Building2 className="h-4 w-4 text-primary" />
                      <h2 className="text-sm font-semibold text-foreground/85 uppercase tracking-wider">1. Institutional Profile</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-1.5 md:col-span-1">
                        <Label className="text-xs font-medium">University Name *</Label>
                        <Input
                          required
                          placeholder="e.g. Gujarat Technological University"
                          value={formData.name}
                          onChange={(e) => handleNameChange(e.target.value)}
                          className="rounded-xl bg-secondary/30 text-xs"
                        />
                      </div>

                      <div className="space-y-1.5 md:col-span-1">
                        <Label className="text-xs font-medium">Subdomain / Slug *</Label>
                        <div className="flex rounded-xl overflow-hidden border border-border bg-secondary/30">
                          <input
                            required
                            placeholder="gtu"
                            value={formData.slug}
                            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                            className="flex-1 bg-transparent px-3 py-2 text-xs focus:outline-none"
                          />
                          <span className="bg-muted px-3 py-2 text-xs text-muted-foreground border-l border-border font-mono">
                            .ignitoexperia.com
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5 md:col-span-1">
                        <Label className="text-xs font-medium">Official Domain</Label>
                        <Input
                          placeholder="e.g. gtu.ac.in"
                          value={formData.domain}
                          onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                          className="rounded-xl bg-secondary/30 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Integration Mode Selection */}
                  <div className="glass rounded-2xl p-6 border border-border/50 shadow-sm space-y-4 bg-card w-full">
                    <div className="flex items-center gap-2 border-b border-border/50 pb-3">
                      <Cpu className="h-4 w-4 text-violet-500" />
                      <h2 className="text-sm font-semibold text-foreground/85 uppercase tracking-wider">2. Integration Mode</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div
                        onClick={() => setOnboardingMode('lms')}
                        className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-4 ${
                          onboardingMode === 'lms'
                            ? 'border-primary bg-primary/10 shadow-sm'
                            : 'border-border/60 bg-secondary/20 hover:border-border'
                        }`}
                      >
                        <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Key className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-foreground/90">With LMS Integration</h3>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            Connect via institutional LMS (Canvas, Moodle, Blackboard, LTI 1.3 / SAML SSO).
                          </p>
                          {onboardingMode === 'lms' && (
                            <span className="inline-block mt-3 text-[10px] font-semibold text-primary bg-primary/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                              Selected
                            </span>
                          )}
                        </div>
                      </div>

                      <div
                        onClick={() => setOnboardingMode('individual')}
                        className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-4 ${
                          onboardingMode === 'individual'
                            ? 'border-primary bg-primary/10 shadow-sm'
                            : 'border-border/60 bg-secondary/20 hover:border-border'
                        }`}
                      >
                        <div className="h-10 w-10 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <GraduationCap className="h-5 w-5 text-violet-500" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-foreground/90">Without LMS (Individual)</h3>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            Direct Experia portal login for individual student & teacher registration.
                          </p>
                          {onboardingMode === 'individual' && (
                            <span className="inline-block mt-3 text-[10px] font-semibold text-violet-600 dark:text-violet-400 bg-violet-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                              Selected
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Tenant Administrator Details */}
                  <div className="glass rounded-2xl p-6 border border-border/50 shadow-sm space-y-4 bg-card w-full">
                    <div className="flex items-center gap-2 border-b border-border/50 pb-3">
                      <User className="h-4 w-4 text-violet-500" />
                      <h2 className="text-sm font-semibold text-foreground/85 uppercase tracking-wider">3. Tenant Administrator Account</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Admin Full Name *</Label>
                        <Input
                          required
                          placeholder="e.g. Dr. Rajesh Patel"
                          value={formData.adminName}
                          onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                          className="rounded-xl bg-secondary/30 text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Admin Email Address *</Label>
                        <Input
                          required
                          type="email"
                          placeholder="e.g. admin@gtu.ac.in"
                          value={formData.adminEmail}
                          onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                          className="rounded-xl bg-secondary/30 text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Contact Phone Number *</Label>
                        <Input
                          required
                          placeholder="e.g. +91 98765 43210"
                          value={formData.adminPhone}
                          onChange={(e) => setFormData({ ...formData, adminPhone: e.target.value })}
                          className="rounded-xl bg-secondary/30 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Form Actions */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={() => setIsOnboarding(false)} className="rounded-xl px-6">
                      Cancel
                    </Button>
                    <Button type="submit" className="rounded-xl bg-primary text-primary-foreground font-semibold px-8">
                      Provision & Onboard Tenant
                    </Button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      </Main>
    </>
  )
}

export const Route = createFileRoute('/_authenticated/universities')({
  component: UniversitiesPage,
})
