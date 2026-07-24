import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { confidenceBand, confidenceBadgeVariant, confidencePercent } from '@/lib/utils/confidence'

/** Colour-coded confidence badge (green ≥80, yellow 50–79, red <50). */
export function ConfidenceBadge({ score }: { score: number }) {
  const band = confidenceBand(score)
  const variant = confidenceBadgeVariant(band)
  return (
    <Badge color={variant}>
      {band === 'low' && <AlertTriangle size={12} aria-hidden />}
      {confidencePercent(score)}%
    </Badge>
  )
}
