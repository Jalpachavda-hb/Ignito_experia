import { createFileRoute } from '@tanstack/react-router'
import { Shield, Globe, Save } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'

export const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsPage,
})

export default function SettingsPage() {
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    alert('Settings updated successfully!')
  }

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
        <div className="space-y-6 max-w-3xl">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Platform Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Adjust SaaS system parameters, billing currency configurations, API token limits, and global notifications.
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="glass rounded-2xl p-5 border border-border space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <Shield className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Security & Access Controls</h3>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-foreground">Require Multi-Factor Authentication</p>
                    <p className="text-muted-foreground">Force college admins to login using Google Authenticator codes.</p>
                  </div>
                  <input type="checkbox" defaultChecked className="h-4 w-4 accent-primary" />
                </div>

                <div className="h-px bg-border/50" />

                <div className="flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-foreground">Session Timeout Limit</p>
                    <p className="text-muted-foreground">Force disconnect owner dashboard sessions after inactivity.</p>
                  </div>
                  <select className="px-2 py-1 rounded bg-secondary border border-border text-xs focus:outline-none">
                    <option>30 Minutes</option>
                    <option>2 Hours</option>
                    <option>12 Hours</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl p-5 border border-border space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <Globe className="h-4 w-4 text-violet-400" />
                <h3 className="text-sm font-semibold text-foreground">Catalog Settings</h3>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Default Credit Cost Per Lab Hour</label>
                    <input type="number" defaultValue={100} className="w-full px-3 py-1.5 rounded-xl bg-secondary border border-border text-xs focus:outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Default Duration Minutes</label>
                    <input type="number" defaultValue={60} className="w-full px-3 py-1.5 rounded-xl bg-secondary border border-border text-xs focus:outline-none" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 active:scale-95 transition-all">
                <Save className="h-4 w-4" />
                Save Configuration
              </button>
            </div>
          </form>
        </div>
      </Main>
    </>
  )
}
