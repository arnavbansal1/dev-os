import { cn } from '@/lib/utils/cn'

/**
 * CSS-only tooltip (hover + keyboard focus), no JS state — safe in Server Components.
 * Wrap the trigger; pass the tooltip copy via `label`.
 */
export function Tooltip({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <span className={cn('group relative inline-flex', className)}>
      <span tabIndex={0} className="inline-flex outline-none" aria-describedby="tooltip">
        {children}
      </span>
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-md',
          'bg-grey-900 px-3 py-2 font-sans text-[12px] leading-[18px] text-white opacity-0 transition',
          'group-hover:opacity-100 group-focus-within:opacity-100',
        )}
      >
        {label}
      </span>
    </span>
  )
}
