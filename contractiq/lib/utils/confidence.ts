/**
 * Confidence banding + colour mapping (key-term-extraction.md).
 * Green ≥ 0.80, Yellow 0.50–0.79, Red < 0.50 — from docs/design.md tokens.
 */
export type ConfidenceBand = 'high' | 'medium' | 'low'

export function confidenceBand(score: number): ConfidenceBand {
  if (score >= 0.8) return 'high'
  if (score >= 0.5) return 'medium'
  return 'low'
}

/** Tailwind badge variant used by ConfidenceBadge (maps to design-system status badges). */
export function confidenceBadgeVariant(band: ConfidenceBand): 'green' | 'yellow' | 'red' {
  switch (band) {
    case 'high':
      return 'green'
    case 'medium':
      return 'yellow'
    case 'low':
      return 'red'
  }
}

export function confidencePercent(score: number): number {
  return Math.round(Math.min(1, Math.max(0, score)) * 100)
}

export const LOW_CONFIDENCE_TOOLTIP =
  'Low confidence — we recommend verifying this in the document directly.'
