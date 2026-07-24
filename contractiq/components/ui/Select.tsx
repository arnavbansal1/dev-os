import { forwardRef } from 'react'
import { cn } from '@/lib/utils/cn'

const selectBase =
  'w-full font-sans text-[16px] leading-6 text-grey-900 bg-white rounded-md border border-grey-100 ' +
  'px-3 py-2 transition focus:outline focus:outline-2 focus:outline-brand focus:border-brand ' +
  'disabled:bg-subtle disabled:text-grey-400'

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(selectBase, className)} {...props}>
        {children}
      </select>
    )
  },
)
