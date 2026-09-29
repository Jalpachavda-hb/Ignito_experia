import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { getCookie, setCookie, removeCookie } from '@/lib/cookies'

type Theme = 'dark' | 'light' | 'system'
type ResolvedTheme = Exclude<Theme, 'system'>

const DEFAULT_THEME: Theme = 'light'
const THEME_COOKIE_NAME = 'vite-ui-theme'
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  defaultTheme: Theme
  resolvedTheme: ResolvedTheme
  theme: Theme
  setTheme: (theme: Theme) => void
  resetTheme: () => void
}

const initialState: ThemeProviderState = {
  defaultTheme: DEFAULT_THEME,
  resolvedTheme: 'light',
  theme: DEFAULT_THEME,
  setTheme: () => null,
  resetTheme: () => null,
}

const ThemeContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = DEFAULT_THEME,
  storageKey = THEME_COOKIE_NAME,
  ...props
}: ThemeProviderProps) {
  const [theme, _setTheme] = useState<Theme>(() => {
    const saved = getCookie(storageKey)
    if (saved === 'dark' || saved === 'system') {
      setCookie(storageKey, 'light', THEME_COOKIE_MAX_AGE)
    }
    return 'light'
  })

  const resolvedTheme = useMemo((): ResolvedTheme => {
    return 'light'
  }, [])

  useEffect(() => {
    const root = window.document.documentElement

    const applyTheme = () => {
      root.classList.remove('dark')
      root.classList.add('light')
    }

    applyTheme()
  }, [theme])

  const setTheme = (newTheme: Theme) => {
    setCookie(storageKey, 'light', THEME_COOKIE_MAX_AGE)
    _setTheme('light')
  }

  const resetTheme = () => {
    setCookie(storageKey, 'light', THEME_COOKIE_MAX_AGE)
    _setTheme('light')
  }

  const contextValue = {
    defaultTheme: 'light' as Theme,
    resolvedTheme: 'light' as ResolvedTheme,
    resetTheme,
    theme: 'light' as Theme,
    setTheme,
  }

  return (
    <ThemeContext value={contextValue} {...props}>
      {children}
    </ThemeContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeContext)

  if (!context) throw new Error('useTheme must be used within a ThemeProvider')

  return context
}
