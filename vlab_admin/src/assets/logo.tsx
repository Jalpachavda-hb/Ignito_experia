import { cn } from '@/lib/utils'

type LogoProps = React.ImgHTMLAttributes<HTMLImageElement>

export function Logo({ className, alt = 'Ignito Experia', ...props }: LogoProps) {
  return (
    <img
      src='/images/logo.png'
      alt={alt}
      className={cn('h-10 w-auto object-contain', className)}
      {...props}
    />
  )
}
