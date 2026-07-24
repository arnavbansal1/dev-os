import { cn } from '@/lib/utils/cn'

/** White surface card with subtle border, flat depth (docs/design.md). */
export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('rounded-lg border border-grey-100 bg-white', className)}>{children}</div>
}
