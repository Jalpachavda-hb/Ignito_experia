import { SearchIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'

export function Search({ className = '', placeholder = 'Search...', ...props }: React.ComponentProps<'button'> & { placeholder?: string }) {
  return (
    <Button
      {...props}
      variant='outline'
      className={cn(
        'group relative h-8 w-full flex-1 justify-start rounded-md bg-muted/25 text-sm font-normal text-muted-foreground shadow-none hover:bg-accent sm:w-40 sm:pe-12 md:flex-none lg:w-52 xl:w-64',
        className
      )}
    >
      <SearchIcon
        aria-hidden='true'
        className='absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground'
        size={14}
      />
      <span className='ml-5'>{placeholder}</span>
      <kbd className='pointer-events-none absolute right-1.5 top-1.5 hidden h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[9px] font-medium opacity-100 select-none group-hover:bg-accent sm:flex'>
        <span className='text-xs'>⌘</span>K
      </kbd>
    </Button>
  )
}
