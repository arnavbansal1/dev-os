import { cn } from '@/lib/utils/cn'

type BadgeColor = 'grey' | 'blue' | 'green' | 'yellow' | 'red'

const colors: Record<BadgeColor, string> = {
  grey: 'bg-grey-50 border-grey-200 text-grey-700',
  blue: 'bg-blue-50 border-blue-200 text-blue-700',
  green: 'bg-green-50 border-green-200 text-green-700',
  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  red: 'bg-red-50 border-red-200 text-red-700',
}

/** Semantic status badge (docs/design.md reusable pattern). */
export function Badge({
  color = 'grey',
  className,
  children,
}: {
  color?: BadgeColor
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 font-sans text-[12px] font-medium leading-[18px]',
        colors[color],
        className,
      )}
    >
      {children}
    </span>
  )
}
