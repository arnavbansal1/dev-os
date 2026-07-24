import { Card } from '@/components/ui/Card'

/** Top-of-dashboard stats (FR-10). */
export function SummaryCard({
  total,
  byType,
}: {
  total: number
  byType: { NDA: number; MSA: number }
}) {
  const stats = [
    { label: 'Contracts reviewed', value: total },
    { label: 'NDAs', value: byType.NDA },
    { label: 'MSAs', value: byType.MSA },
  ]
  return (
    <Card className="grid grid-cols-3 divide-x divide-grey-100">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col gap-1 p-6">
          <span className="font-sans text-[28px] font-semibold leading-9 text-grey-900">{s.value}</span>
          <span className="font-sans text-[12px] text-grey-500">{s.label}</span>
        </div>
      ))}
    </Card>
  )
}
