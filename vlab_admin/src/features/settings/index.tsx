import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileSettings } from './components/profile-settings'

export default function SettingsView() {
  return (
    <>
      <Header>
        <Search />
        <div className='ml-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>
      
      <Main className="bg-muted/5 pb-8">
        <div className="max-w-4xl mx-auto h-full mt-6">
          <ProfileSettings />
        </div>
      </Main>
    </>
  )
}
