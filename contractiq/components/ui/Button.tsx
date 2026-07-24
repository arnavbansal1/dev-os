import { forwardRef } from 'react'
import { cn } from '@/lib/utils/cn'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const base =
  'inline-flex items-center justify-center gap-2 font-sans font-medium rounded-md transition ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ' +
  'disabled:opacity-50 disabled:pointer-events-none'

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-blue-600 active:bg-blue-700',
  ghost: 'bg-white text-grey-900 border border-grey-100 hover:border-grey-200 hover:bg-subtle',
  danger: 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700',
}

const sizes: Record<Size, string> = {
  sm: 'text-[12px] leading-[18px] px-3 py-2',
  md: 'text-[16px] leading-6 px-6 py-3',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner size={size === 'sm' ? 14 : 18} />}
      {children}
    </button>
  )
})
