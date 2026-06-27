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
      
      <Main className="bg-[#fcfcfc] dark:bg-background min-h-[calc(100vh-3.5rem)]">
        <div className="space-y-6 max-w-[1600px] mx-auto py-6 px-6">
          <ProfileSettings />
        </div>
      </Main>
    </>
  )
}
