import { createFileRoute } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import {
    AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { Building2, DollarSign, Users, Cpu } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'

export const Route = createFileRoute('/_authenticated/')({
    component: DashboardPage,
})

const REVENUE_TREND_DATA = [
    { month: 'Jul', saas: 180000, credits: 100000, total: 280000 },
    { month: 'Aug', saas: 200000, credits: 110000, total: 310000 },
    { month: 'Sep', saas: 190000, credits: 105000, total: 295000 },
    { month: 'Oct', saas: 220000, credits: 120000, total: 340000 },
    { month: 'Nov', saas: 230000, credits: 130000, total: 360000 },
    { month: 'Dec', saas: 250000, credits: 140000, total: 390000 },
    { month: 'Jan', saas: 230000, credits: 125000, total: 355000 },
    { month: 'Feb', saas: 245000, credits: 135000, total: 380000 },
]

const DAILY_LAB_COMPUTE_DATA = [
    { time: '00:00', active: 220, capacity: 1000 },
    { time: '04:00', active: 110, capacity: 1000 },
    { time: '08:00', active: 650, capacity: 1000 },
    { time: '12:00', active: 940, capacity: 1000 },
    { time: '16:00', active: 780, capacity: 1000 },
    { time: '20:00', active: 430, capacity: 1000 },
    { time: '23:59', active: 290, capacity: 1000 },
]

const TOP_TENANTS = [
    { name: 'Pune Tech University', code: 'PU', labs: '1,420 labs', percent: 92, color: 'bg-rose-500/80' },
    { name: 'Mumbai Digital Institute', code: 'MU', labs: '1,150 labs', percent: 78, color: 'bg-violet-500/80' },
    { name: 'Bangalore CS Academy', code: 'BA', labs: '980 labs', percent: 65, color: 'bg-emerald-500/80' },
    { name: 'Chennai Engineering College', code: 'CH', labs: '750 labs', percent: 52, color: 'bg-sky-500/80' },
    { name: 'Delhi Innovation College', code: 'DE', labs: '520 labs', percent: 38, color: 'bg-amber-500/80' },
]

const MOST_USED_LABS = [
    { name: 'Ubuntu Base Container', count: 420, percent: 88, color: 'bg-emerald-500/80' },
    { name: 'Data Science & Python Notebook', count: 320, percent: 72, color: 'bg-violet-500/80' },
    { name: 'Full-Stack Web Dev Studio', count: 280, percent: 62, color: 'bg-rose-500/80' },
    { name: 'Cybersecurity & Kali Linux', count: 210, percent: 48, color: 'bg-sky-500/80' },
    { name: 'Database Admin Workstation', count: 170, percent: 38, color: 'bg-amber-500/80' },
]

function ExecutiveCard({
    title,
    value,
    subtitle,
    icon: Icon,
    accentColor,
}: {
    title: string
    value: string
    subtitle: string
    icon: React.ElementType
    accentColor: 'rose' | 'emerald' | 'violet' | 'sky'
}) {
    const colorMap = {
        rose: { bg: 'bg-rose-500/10', text: 'text-rose-500 dark:text-rose-400', valueText: 'text-foreground/90' },
        emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-500 dark:text-emerald-400', valueText: 'text-emerald-600 dark:text-emerald-400' },
        violet: { bg: 'bg-violet-500/10', text: 'text-violet-500 dark:text-violet-400', valueText: 'text-foreground/90' },
        sky: { bg: 'bg-sky-500/10', text: 'text-sky-500 dark:text-sky-400', valueText: 'text-foreground/90' },
    }

    const active = colorMap[accentColor]

    return (
        <div className="relative overflow-hidden glass rounded-2xl p-5 border border-border/50 shadow-sm transition-all hover:shadow-md bg-card">
            <div className={cn('absolute top-0 right-0 h-14 w-14 rounded-bl-full flex items-start justify-end p-3', active.bg)}>
                <Icon className={cn('h-4 w-4', active.text)} />
            </div>
            <p className="text-xs font-medium text-muted-foreground/80 tracking-wide">{title}</p>
            <p className={cn('text-2xl sm:text-3xl font-semibold mt-2.5 tracking-tight', active.valueText)}>{value}</p>
            <p className="text-xs text-muted-foreground/70 mt-1 font-normal">{subtitle}</p>
        </div>
    )
}

function CustomRevenueTooltip({ active, payload, label }: any) {
    if (active && payload && payload.length) {
        const saas = payload.find((p: any) => p.dataKey === 'saas')?.value || 0
        const credits = payload.find((p: any) => p.dataKey === 'credits')?.value || 0
        return (
            <div className="bg-card border border-border/80 rounded-xl p-3 shadow-lg text-xs space-y-1.5 min-w-[150px]">
                <p className="font-semibold text-foreground/90">{label}</p>
                <p className="text-rose-500 font-medium flex items-center justify-between">
                    <span>SaaS Plan :</span>
                    <span className="font-semibold">{formatCurrency(saas)}</span>
                </p>
                <p className="text-violet-500 font-medium flex items-center justify-between">
                    <span>Credits Burn :</span>
                    <span className="font-semibold">{formatCurrency(credits)}</span>
                </p>
            </div>
        )
    }
    return null
}

export default function DashboardPage() {
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
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground/90">Platform Executive Dashboard</h1>
                        <p className="text-xs text-muted-foreground/80 mt-1 font-normal">
                            High-level operational oversight, monthly revenue growth, active compute loads, and tenant performance.
                        </p>
                    </div>

                    {/* Top 4 Essential Owner KPI Cards with lighter typography */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <ExecutiveCard
                            title="Onboarded Universities"
                            value="42 Institutions"
                            subtitle="+12.4% YoY Expansion"
                            icon={Building2}
                            accentColor="rose"
                        />
                        <ExecutiveCard
                            title="Monthly Recurring Revenue"
                            value={formatCurrency(2710000)}
                            subtitle="+15.8% Overall Growth"
                            icon={DollarSign}
                            accentColor="emerald"
                        />
                        <ExecutiveCard
                            title="Active Platform Students"
                            value="12,450 Users"
                            subtitle="+8.2% Active Engagement"
                            icon={Users}
                            accentColor="violet"
                        />
                        <ExecutiveCard
                            title="Active Concurrent Labs"
                            value="1,204 Containers"
                            subtitle="84 Total Lab Templates"
                            icon={Cpu}
                            accentColor="sky"
                        />
                    </div>

                    {/* Row 2: Revenue & MRR Growth (2/3 width) + Top Tenants by Credit Burn (1/3 width) */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* Revenue Trend Chart */}
                        <div className="lg:col-span-2 glass rounded-2xl p-6 border border-border/50 shadow-sm space-y-4 bg-card">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-base font-semibold text-foreground/85">Monthly Platform Revenue Trend</h3>
                                    <p className="text-xs text-muted-foreground/75 mt-0.5 font-normal">
                                        Combined growth of SaaS Subscriptions vs Credit consumption revenue.
                                    </p>
                                </div>
                                <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
                                    <span className="flex items-center gap-1.5 text-rose-500 font-normal">
                                        <span className="h-2 w-2 rounded-full bg-rose-500/80" /> SaaS Subscription
                                    </span>
                                    <span className="flex items-center gap-1.5 text-violet-500 font-normal">
                                        <span className="h-2 w-2 rounded-full bg-violet-500/80" /> Credits Burn
                                    </span>
                                </div>
                            </div>

                            <div className="h-[290px] w-full pt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={REVENUE_TREND_DATA} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="saasGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                                                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.01} />
                                            </linearGradient>
                                            <linearGradient id="credGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.01} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.94 0.01 255)" />
                                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'oklch(0.60 0.03 250)' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'oklch(0.60 0.03 250)' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
                                        <Tooltip content={<CustomRevenueTooltip />} />
                                        <Area
                                            type="monotone"
                                            dataKey="saas"
                                            stroke="#f43f5e"
                                            strokeWidth={2}
                                            fill="url(#saasGrad)"
                                            dot={false}
                                            activeDot={{ fill: '#f43f5e', r: 4, stroke: '#ffffff', strokeWidth: 2 }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="credits"
                                            stroke="#8b5cf6"
                                            strokeWidth={2}
                                            fill="url(#credGrad)"
                                            dot={false}
                                            activeDot={{ fill: '#8b5cf6', r: 4, stroke: '#ffffff', strokeWidth: 2 }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Top Onboarded Universities by Activity */}
                        <div className="glass rounded-2xl p-6 border border-border/50 shadow-sm space-y-4 bg-card flex flex-col justify-between">
                            <div>
                                <h3 className="text-base font-semibold text-foreground/85">Top Tenant Universities</h3>
                                <p className="text-xs text-muted-foreground/75 mt-0.5 font-normal">Highest active lab instantiations & credit usage.</p>
                            </div>

                            <div className="space-y-3.5 pt-1">
                                {TOP_TENANTS.map((tenant) => (
                                    <div key={tenant.name} className="space-y-1">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-medium text-foreground/80 truncate max-w-[170px]">{tenant.name}</span>
                                            <span className="text-[10px] text-muted-foreground/70 font-normal">{tenant.labs}</span>
                                        </div>
                                        <div className="w-full bg-secondary/40 h-1.5 rounded-full overflow-hidden">
                                            <div className={cn('h-full rounded-full transition-all', tenant.color)} style={{ width: `${tenant.percent}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>

                    {/* Row 3: Real-Time Compute Instantiation Load (2/3 width) + Popular Environments (1/3 width) */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* Daily Compute Instantiation Load */}
                        <div className="lg:col-span-2 glass rounded-2xl p-6 border border-border/50 shadow-sm space-y-4 bg-card">
                            <div>
                                <h3 className="text-base font-semibold text-foreground/85">Daily Container Compute Load</h3>
                                <p className="text-xs text-muted-foreground/75 mt-0.5 font-normal">
                                    Peak hour concurrent lab container instances running across AWS SSM & Docker hosts.
                                </p>
                            </div>

                            <div className="h-[240px] w-full pt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={DAILY_LAB_COMPUTE_DATA} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="compGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                                                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.01} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.94 0.01 255)" />
                                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'oklch(0.60 0.03 250)' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'oklch(0.60 0.03 250)' }} domain={[0, 1000]} ticks={[0, 250, 500, 750, 1000]} />
                                        <Tooltip
                                            contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                                            formatter={(val: number) => [`${val} active labs`, 'Running Compute']}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="active"
                                            stroke="#0ea5e9"
                                            strokeWidth={2}
                                            fill="url(#compGrad)"
                                            dot={false}
                                            activeDot={{ fill: '#0ea5e9', r: 4, stroke: '#ffffff', strokeWidth: 2 }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Most Used Virtual Lab Templates */}
                        <div className="glass rounded-2xl p-6 border border-border/50 shadow-sm space-y-4 bg-card flex flex-col justify-between">
                            <div>
                                <h3 className="text-base font-semibold text-foreground/85">Top Virtual Environments</h3>
                                <p className="text-xs text-muted-foreground/75 mt-0.5 font-normal">Most launched lab templates by students.</p>
                            </div>

                            <div className="space-y-3 pt-1">
                                {MOST_USED_LABS.map((lab) => (
                                    <div key={lab.name} className="space-y-1">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-medium text-foreground/80 truncate max-w-[170px]">{lab.name}</span>
                                            <span className="text-[10px] text-muted-foreground/70 font-normal">{lab.count} sessions</span>
                                        </div>
                                        <div className="w-full bg-secondary/40 h-1.5 rounded-full overflow-hidden">
                                            <div className={cn('h-full rounded-full transition-all', lab.color)} style={{ width: `${lab.percent}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>
            </Main>
        </>
    )
}
