'use client'

import type { KeyTerm } from '@/types'
import { TermRow } from './TermRow'

/** Right-panel list of extracted terms (US-011-partial, FR-04). */
export function KeyTermsPanel({
  keyTerms,
  onNavigate,
  onTermUpdated,
}: {
  keyTerms: KeyTerm[]
  onNavigate: (page: number) => void
  onTermUpdated: (term: KeyTerm) => void
}) {
  if (keyTerms.length === 0) {
    return (
      <p className="font-sans text-[12px] text-grey-500">No key terms were extracted for this contract.</p>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between pb-2">
        <h2 className="font-sans text-[16px] font-semibold text-grey-900">Key terms</h2>
        <span className="font-sans text-[12px] text-grey-500">{keyTerms.length} terms</span>
      </div>
      <div className="flex flex-col">
        {keyTerms.map((term) => (
          <TermRow key={term.id} term={term} onNavigate={onNavigate} onUpdated={onTermUpdated} />
        ))}
      </div>
    </div>
  )
}
