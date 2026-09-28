import { Toaster as Sonner, ToasterProps } from 'sonner'

export function Toaster({ ...props }: ToasterProps) {
  const theme = (
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light'
  ) as ToasterProps['theme']

  return (
    <Sonner
      theme={theme}
      className='toaster group [&_div[data-content]]:w-full'
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}
