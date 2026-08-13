import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Plus, Search as SearchIcon, Mail, Phone, ArrowLeft, Building2, User, Key, CheckCircle2,
  GraduationCap, Cpu, Eye, EyeOff, Upload, ImageIcon, RefreshCw, ShieldCheck, Pencil, Trash2,
  AlertTriangle, X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiRequest } from '@/services/api'

export interface UniversityTenant {
  id: string
  tenantId: string
  name: string
  code: string
  slug: string
  subdomain: string
  officialDomain: string
  logoUrl: string
  integrationMode: string
  mode: string
  status: string
  email: string
  phone: string
  adminName: string
  students: number
  faculty: number
  credits: string
  createdDate?: string
}

function UniversitiesPage() {
  const queryClient = useQueryClient()
  const [isOnboarding, setIsOnboarding] = useState(false)
  const [onboardingMode, setOnboardingMode] = useState<'LMS' | 'DIRECT'>('LMS')
  const [searchQuery, setSearchQuery] = useState('')

  const [submitted, setSubmitted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    domain: '',
    logoUrl: '',
    adminName: '',
    adminEmail: '',
    adminPhone: '',
    adminPassword: '',
  })

  // Edit Tenant State
  const [editingTenant, setEditingTenant] = useState<UniversityTenant | null>(null)
  const [editFormData, setEditFormData] = useState({
    name: '',
    officialDomain: '',
    logoUrl: '',
    adminName: '',
    adminEmail: '',
    adminPhone: '',
  })

  // Delete Tenant State
  const [deletingTenant, setDeletingTenant] = useState<UniversityTenant | null>(null)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)

  const handleFileUpload = async (file: File, isEditMode: boolean = false) => {
    try {
      setIsUploadingLogo(true)
      const uploadData = new FormData()
      uploadData.append('file', file)

      const response = await fetch('http://localhost:4000/api/upload', {
        method: 'POST',
        body: uploadData,
      })

      const res = await response.json()
      if (res.success && res.url) {
        if (isEditMode) {
          setEditFormData(prev => ({ ...prev, logoUrl: res.url }))
        } else {
          setFormData(prev => ({ ...prev, logoUrl: res.url }))
        }
        toast.success('Logo uploaded to server successfully!')
      } else {
        toast.error(res.message || 'Failed to upload logo image')
      }
    } catch (err: any) {
      console.error('Error uploading file:', err)
      toast.error('Server error while uploading logo image')
    } finally {
      setIsUploadingLogo(false)
    }
  }

  // Fetch University Tenants from API
  const { data: tenantList = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-universities'],
    queryFn: async (): Promise<UniversityTenant[]> => {
      try {
        const response = await apiRequest<{ success: boolean; data: UniversityTenant[] }>('/admin/universities')
        if (response?.success && Array.isArray(response.data)) {
          return response.data
        }
        return []
      } catch (err) {
        console.error('Error fetching tenant list from API:', err)
        return []
      }
    },
  })

  // Provision Tenant Mutation
  const provisionMutation = useMutation({
    mutationFn: async (payload: typeof formData & { integrationMode: string }) => {
      return await apiRequest<{ success: boolean; message: string; data: any }>('/admin/universities', {
        method: 'POST',
        body: JSON.stringify({
          name: payload.name,
          slug: payload.slug,
          officialDomain: payload.domain,
          logoUrl: payload.logoUrl,
          integrationMode: payload.integrationMode,
          adminName: payload.adminName,
          adminEmail: payload.adminEmail,
          adminPhone: payload.adminPhone,
          adminPassword: payload.adminPassword,
        }),
      })
    },
    onSuccess: (res) => {
      setSubmitted(true)
      toast.success(res?.message || 'University Tenant provisioned successfully!')
      queryClient.invalidateQueries({ queryKey: ['admin-universities'] })
      setTimeout(() => {
        setSubmitted(false)
        setIsOnboarding(false)
        setFormData({
          name: '',
          slug: '',
          domain: '',
          logoUrl: '',
          adminName: '',
          adminEmail: '',
          adminPhone: '',
          adminPassword: '',
        })
      }, 1800)
    },
    onError: (err: any) => {
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to provision tenant'
      toast.error(errMsg)
    },
  })

  // Update Tenant Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ tenantId, data }: { tenantId: string; data: typeof editFormData }) => {
      return await apiRequest<{ success: boolean; message: string }>(`/admin/universities/${tenantId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
    },
    onSuccess: (res) => {
      toast.success(res?.message || 'University updated successfully!')
      queryClient.invalidateQueries({ queryKey: ['admin-universities'] })
      setEditingTenant(null)
    },
    onError: (err: any) => {
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to update university'
      toast.error(errMsg)
    },
  })

  // Delete Tenant Mutation
  const deleteMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      return await apiRequest<{ success: boolean; message: string }>(`/admin/universities/${tenantId}`, {
        method: 'DELETE',
      })
    },
    onSuccess: (res) => {
      toast.success(res?.message || 'University tenant deleted successfully!')
      queryClient.invalidateQueries({ queryKey: ['admin-universities'] })
      setDeletingTenant(null)
    },
    onError: (err: any) => {
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to delete university tenant'
      toast.error(errMsg)
    },
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
    provisionMutation.mutate({
      ...formData,
      integrationMode: onboardingMode,
    })
  }

  const handleStartEdit = (uni: UniversityTenant) => {
    setEditingTenant(uni)
    setEditFormData({
      name: uni.name,
      officialDomain: uni.officialDomain || '',
      logoUrl: uni.logoUrl || '',
      adminName: uni.adminName || '',
      adminEmail: uni.email || '',
      adminPhone: uni.phone || '',
    })
  }

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingTenant) {
      updateMutation.mutate({
        tenantId: editingTenant.tenantId || editingTenant.id,
        data: editFormData,
      })
    }
  }

  const filteredUnis = tenantList.filter(uni => {
    return (
      uni.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      uni.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      uni.slug.toLowerCase().includes(searchQuery.toLowerCase())
    )
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
                    Provision multi-tenant SaaS profile, reserve unique slug, set custom branding, and configure initial Tenant Administrator account.
                  </p>
                </div>
              </div>

              {submitted ? (
                <div className="glass rounded-2xl p-12 border border-emerald-500/30 text-center space-y-4 bg-emerald-500/5">
                  <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto animate-bounce" />
                  <h2 className="text-2xl font-bold text-foreground">University Tenant Provisioned Successfully!</h2>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    {formData.name || 'New University'} has been onboarded in {onboardingMode === 'LMS' ? 'With LMS Integration' : 'Without LMS (Individual)'} mode. Tenant ID generated & Administrator linked.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Section 1: Institutional Profile */}
                  <div className="glass rounded-2xl p-6 border border-border/50 shadow-sm space-y-4 bg-card w-full">
                    <div className="flex items-center justify-between border-b border-border/50 pb-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" />
                        <h2 className="text-sm font-semibold text-foreground/85 uppercase tracking-wider">1. Institutional Profile & Branding</h2>
                      </div>
                      <span className="text-[11px] font-medium text-muted-foreground/80">
                        {formData.logoUrl ? '✓ Custom Logo Active' : 'ℹ Uses Default Experia Logo if Empty'}
                      </span>
                    </div>

                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">University Name *</Label>
                          <Input
                            required
                            placeholder="e.g. Gujarat Technological University"
                            value={formData.name}
                            onChange={(e) => handleNameChange(e.target.value)}
                            className="rounded-xl bg-secondary/30 text-xs"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Subdomain / Slug *</Label>
                          <div className="flex rounded-xl overflow-hidden border border-border bg-secondary/30">
                            <input
                              required
                              placeholder="gtu"
                              value={formData.slug}
                              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                              className="flex-1 bg-transparent px-3 py-2 text-xs focus:outline-none font-mono"
                            />
                            <span className="bg-muted px-3 py-2 text-xs text-muted-foreground border-l border-border font-mono">
                              .experia.ignitolearn.com
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Official Domain</Label>
                          <Input
                            placeholder="e.g. gtu.ac.in"
                            value={formData.domain}
                            onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                            className="rounded-xl bg-secondary/30 text-xs"
                          />
                        </div>
                      </div>

                      {/* Dedicated Image File Upload Dropzone */}
                      <div className="space-y-1.5 pt-1">
                        <Label className="text-xs font-semibold flex items-center justify-between">
                          <span>University Logo / Branding Asset</span>
                          <span className="text-[11px] font-normal text-muted-foreground">
                            {formData.logoUrl ? '✓ Custom Logo Active' : 'ℹ Uses Default Experia Logo if Empty'}
                          </span>
                        </Label>

                        <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl border-2 border-dashed border-border/80 bg-secondary/20 hover:border-primary/50 transition-all">
                          <div className="h-16 w-16 rounded-2xl bg-card border border-border/80 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-2xs">
                            {formData.logoUrl ? (
                              <img src={formData.logoUrl} alt="Tenant Logo Preview" className="h-full w-full object-cover" />
                            ) : (
                              <ImageIcon className="h-7 w-7 text-primary/70" />
                            )}
                          </div>

                          <div className="flex-1 space-y-1 text-center sm:text-left min-w-0">
                            <p className="text-xs font-semibold text-foreground/90">
                              Upload Custom Tenant Logo (PNG, SVG, JPG)
                            </p>
                            <p className="text-[11px] text-muted-foreground/80">
                              Recommended size 512x512px. Uploading a custom logo replaces the default Experia logo for this specific university domain.
                            </p>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <label className={cn(
                              "cursor-pointer px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all flex items-center gap-2 shadow-2xs",
                              isUploadingLogo && "opacity-60 pointer-events-none"
                            )}>
                              {isUploadingLogo ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                              <span>{isUploadingLogo ? "Uploading..." : "Upload Image"}</span>
                              <input
                                type="file"
                                accept="image/*"
                                disabled={isUploadingLogo}
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) {
                                    handleFileUpload(file, false)
                                  }
                                }}
                              />
                            </label>

                            {formData.logoUrl && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setFormData({ ...formData, logoUrl: '' })}
                                className="text-xs text-rose-500 border-rose-200 dark:border-rose-900/40 hover:bg-rose-500/10 rounded-xl"
                              >
                                Reset to Default
                              </Button>
                            )}
                          </div>
                        </div>
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
                        onClick={() => setOnboardingMode('LMS')}
                        className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-4 ${
                          onboardingMode === 'LMS'
                            ? 'border-primary bg-primary/10 shadow-sm'
                            : 'border-border/60 bg-secondary/20 hover:border-border'
                        }`}
                      >
                        <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Key className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm text-foreground/90">With LMS Integration</h3>
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">Active Phase 1</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                            Provisions Tenant entity & reserved slug. LMS credentials & SSO endpoint mapping will be configured in Phase 2.
                          </p>
                          {onboardingMode === 'LMS' && (
                            <span className="inline-block mt-3 text-[10px] font-semibold text-primary bg-primary/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                              Selected
                            </span>
                          )}
                        </div>
                      </div>

                      <div
                        className="p-5 rounded-2xl border-2 border-border/40 bg-secondary/10 opacity-70 cursor-not-allowed flex items-start gap-4 relative"
                      >
                        <div className="h-10 w-10 rounded-xl bg-slate-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <GraduationCap className="h-5 w-5 text-slate-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm text-foreground/70">Without LMS (Individual DIRECT)</h3>
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">Coming in Phase 2</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                            Direct Experia portal login for individual student & teacher registration without university LMS connection.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Tenant Administrator Details */}
                  <div className="glass rounded-2xl p-6 border border-border/50 shadow-sm space-y-4 bg-card w-full">
                    <div className="flex items-center gap-2 border-b border-border/50 pb-3">
                      <User className="h-4 w-4 text-violet-500" />
                      <h2 className="text-sm font-semibold text-foreground/85 uppercase tracking-wider">3. Initial Tenant Administrator Account</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                        <Label className="text-xs font-medium">Contact Phone Number</Label>
                        <Input
                          placeholder="e.g. +91 98765 43210"
                          value={formData.adminPhone}
                          onChange={(e) => setFormData({ ...formData, adminPhone: e.target.value })}
                          className="rounded-xl bg-secondary/30 text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Admin Password *</Label>
                        <div className="relative">
                          <Input
                            required
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••••••"
                            value={formData.adminPassword}
                            onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                            className="rounded-xl bg-secondary/30 text-xs font-mono pr-9"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground transition-colors p-0.5 rounded-md"
                            title={showPassword ? 'Hide Password' : 'Show Password'}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Form Actions */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={() => setIsOnboarding(false)} className="rounded-xl px-6">
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={provisionMutation.isPending}
                      className="rounded-xl bg-primary text-primary-foreground font-semibold px-8 flex items-center gap-2"
                    >
                      {provisionMutation.isPending && <RefreshCw className="h-4 w-4 animate-spin" />}
                      <span>Provision & Onboard Tenant</span>
                    </Button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground/90 flex items-center gap-2">
                    University Management
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  </h1>
                  <p className="text-xs text-muted-foreground/80 mt-1 font-normal">
                    Manage multi-tenant SaaS university registrations, tenant IDs, reserved slugs, and student allocations.
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
                    placeholder="Search by name, slug, or email..."
                    className="pl-9 bg-secondary/30 rounded-xl text-xs"
                  />
                </div>
                <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Refresh</span>
                </Button>
              </div>

              {filteredUnis.length === 0 ? (
                <div className="glass rounded-2xl p-12 border border-border/60 text-center space-y-4 bg-card/60 max-w-md mx-auto my-8">
                  <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
                    <Building2 className="h-8 w-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">No University Tenants Found</h3>
                    <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                      {searchQuery
                        ? `No tenants match "${searchQuery}". Try searching by another slug or name.`
                        : 'No university tenants have been provisioned yet. Click below to onboard your first tenant.'}
                    </p>
                  </div>
                  {!searchQuery && (
                    <Button onClick={() => setIsOnboarding(true)} className="rounded-xl bg-primary text-primary-foreground font-semibold px-6 text-xs gap-2">
                      <Plus className="h-4 w-4" />
                      <span>Onboard University</span>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredUnis.map(uni => (
                    <div
                      key={uni.id || uni.tenantId}
                      className="glass rounded-2xl p-5 border border-border/50 hover:shadow-md hover:border-primary/40 transition-all flex flex-col justify-between h-[230px] bg-card relative group"
                    >
                      <div>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            {uni.logoUrl ? (
                              <img src={uni.logoUrl} alt={uni.name} className="h-10 w-10 rounded-xl object-cover border border-border/50 shadow-2xs flex-shrink-0" />
                            ) : (
                              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-xs flex-shrink-0">
                                {uni.code || 'UNI'}
                              </div>
                            )}
                            <div className="min-w-0">
                              <h3 className="font-semibold text-foreground/90 text-sm truncate">{uni.name}</h3>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[11px] font-mono text-muted-foreground truncate">
                                  {uni.subdomain}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Top Action Buttons (Edit & Delete with Red Hover) */}
                          <div className="flex items-center gap-1">
                            <span className={cn(
                              'h-2.5 w-2.5 rounded-full flex-shrink-0 mr-1',
                              (uni.status || '').toLowerCase() === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                            )} />
                            <button
                              onClick={() => handleStartEdit(uni)}
                              className="p-1.5 rounded-lg border border-border/60 bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                              title="Edit University"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setDeletingTenant(uni)}
                              className="p-1.5 rounded-lg border border-border/60 bg-secondary/30 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 hover:border-rose-500/30 transition-all"
                              title="Delete University"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 space-y-1.5 text-xs text-muted-foreground/80">
                          <div className="flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground/80 flex-shrink-0" />
                            <span className="truncate">{uni.email}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground/80 flex-shrink-0" />
                            <span>{uni.phone}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-border/50 pt-3 mt-3">
                        <div className="text-left">
                          <p className="text-[10px] text-muted-foreground/70 uppercase font-semibold tracking-wider">STUDENTS</p>
                          <p className="text-sm font-semibold text-foreground/90 mt-0.5">{uni.students}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground/70 uppercase font-semibold tracking-wider">FACULTY</p>
                          <p className="text-sm font-semibold text-foreground/90 mt-0.5">{uni.faculty}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground/70 uppercase font-semibold tracking-wider">CREDITS</p>
                          <p className="text-sm font-semibold text-rose-500 dark:text-rose-400 mt-0.5">{uni.credits}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* EDIT UNIVERSITY MODAL */}
          {editingTenant && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setEditingTenant(null)} />
              <div className="relative glass rounded-3xl w-full max-w-2xl border border-border/80 p-6 sm:p-7 space-y-6 bg-card shadow-2xl z-10 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-border/60 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary flex-shrink-0">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-foreground">Edit University Tenant</h2>
                      <p className="text-xs text-muted-foreground">
                        Update institutional details, custom branding logo, and tenant administrator account.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingTenant(null)}
                    className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleUpdateSubmit} className="space-y-6">
                  {/* Institutional Info */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-primary" />
                      Institutional Profile
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5 md:col-span-2">
                        <Label className="text-xs font-medium">University Name *</Label>
                        <Input
                          required
                          value={editFormData.name}
                          onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                          className="rounded-xl bg-secondary/30 text-xs"
                        />
                      </div>

                      <div className="space-y-1.5 md:col-span-2">
                        <Label className="text-xs font-medium">Official Domain</Label>
                        <Input
                          placeholder="e.g. gtu.ac.in"
                          value={editFormData.officialDomain}
                          onChange={(e) => setEditFormData({ ...editFormData, officialDomain: e.target.value })}
                          className="rounded-xl bg-secondary/30 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Logo Upload & Live Preview */}
                  <div className="space-y-2 pt-1 border-t border-border/40">
                    <Label className="text-xs font-semibold flex items-center justify-between">
                      <span>Tenant Branding Logo</span>
                      <span className="text-[11px] font-normal text-muted-foreground">
                        {editFormData.logoUrl ? '✓ Custom Logo Configured' : 'ℹ Default Experia Logo'}
                      </span>
                    </Label>

                    <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl border-2 border-dashed border-border/80 bg-secondary/20 hover:border-primary/50 transition-all">
                      <div className="h-16 w-16 rounded-2xl bg-card border border-border/80 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-2xs">
                        {editFormData.logoUrl ? (
                          <img src={editFormData.logoUrl} alt="Logo Preview" className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-7 w-7 text-primary/70" />
                        )}
                      </div>

                      <div className="flex-1 space-y-1 text-center sm:text-left min-w-0">
                        <p className="text-xs font-semibold text-foreground/90">
                          Tenant Branding Image (PNG, SVG, JPG)
                        </p>
                        <p className="text-[11px] text-muted-foreground/80">
                          Selecting an image replaces the default Experia logo for this university domain.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <label className={cn(
                          "cursor-pointer px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all flex items-center gap-2 shadow-2xs",
                          isUploadingLogo && "opacity-60 pointer-events-none"
                        )}>
                          {isUploadingLogo ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                          <span>{isUploadingLogo ? "Uploading..." : "Upload Logo"}</span>
                          <input
                            type="file"
                            accept="image/*"
                            disabled={isUploadingLogo}
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                handleFileUpload(file, true)
                              }
                            }}
                          />
                        </label>

                        {editFormData.logoUrl && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEditFormData({ ...editFormData, logoUrl: '' })}
                            className="text-xs text-rose-500 border-rose-200 dark:border-rose-900/40 hover:bg-rose-500/10 rounded-xl"
                          >
                            Reset
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tenant Administrator Details */}
                  <div className="space-y-4 pt-1 border-t border-border/40">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-violet-500" />
                      Tenant Administrator Details
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5 md:col-span-2">
                        <Label className="text-xs font-medium">Admin Full Name</Label>
                        <Input
                          value={editFormData.adminName}
                          onChange={(e) => setEditFormData({ ...editFormData, adminName: e.target.value })}
                          className="rounded-xl bg-secondary/30 text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Admin Email Address</Label>
                        <Input
                          type="email"
                          value={editFormData.adminEmail}
                          onChange={(e) => setEditFormData({ ...editFormData, adminEmail: e.target.value })}
                          className="rounded-xl bg-secondary/30 text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Contact Phone Number</Label>
                        <Input
                          value={editFormData.adminPhone}
                          onChange={(e) => setEditFormData({ ...editFormData, adminPhone: e.target.value })}
                          className="rounded-xl bg-secondary/30 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
                    <Button type="button" variant="outline" onClick={() => setEditingTenant(null)} className="rounded-xl px-6">
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={updateMutation.isPending}
                      className="rounded-xl bg-primary text-primary-foreground font-semibold px-7 flex items-center gap-2"
                    >
                      {updateMutation.isPending && <RefreshCw className="h-4 w-4 animate-spin" />}
                      <span>Save Changes</span>
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* DELETE CONFIRMATION DIALOG */}
          {deletingTenant && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeletingTenant(null)} />
              <div className="relative glass rounded-2xl w-full max-w-md border border-border p-6 space-y-5 bg-card shadow-2xl">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center flex-shrink-0 text-rose-500">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">Delete University Tenant</h2>
                    <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
                  </div>
                </div>

                <div className="rounded-xl bg-rose-500/5 border border-rose-500/20 p-4 text-xs text-foreground space-y-1">
                  <p>
                    Are you sure you want to delete <strong className="font-bold text-rose-500">{deletingTenant.name}</strong>?
                  </p>
                  <p className="text-muted-foreground font-mono">
                    Subdomain: {deletingTenant.subdomain}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setDeletingTenant(null)} className="rounded-xl px-5">
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(deletingTenant.tenantId || deletingTenant.id)}
                    className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold px-6 flex items-center gap-2"
                  >
                    {deleteMutation.isPending && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                    <span>{deleteMutation.isPending ? 'Deleting...' : 'Delete Tenant'}</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

        </div>
      </Main>
    </>
  )
}

export const Route = createFileRoute('/_authenticated/universities')({
  component: UniversitiesPage,
})
