'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { limits } from '@/lib/env'

/**
 * Shows the standard terms ContractIQ will extract, plus an adder for up to
 * `MAX_CUSTOM_TERMS` custom terms (US-005).
 */
export function TermPreviewList({
  standardTerms,
  customTerms,
  onCustomTermsChange,
  disabled,
}: {
  standardTerms: string[]
  customTerms: string[]
  onCustomTermsChange: (terms: string[]) => void
  disabled?: boolean
}) {
  const [draft, setDraft] = useState('')
  const atLimit = customTerms.length >= limits.maxCustomTerms

  function addTerm() {
    const trimmed = draft.trim()
    if (!trimmed || atLimit) return
    if (customTerms.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setDraft('')
      return
    }
    onCustomTermsChange([...customTerms, trimmed])
    setDraft('')
  }

  function removeTerm(term: string) {
    onCustomTermsChange(customTerms.filter((t) => t !== term))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="font-sans text-[12px] font-medium text-grey-500">
          Standard terms we&apos;ll look for
        </p>
        <div className="flex flex-wrap gap-2">
          {standardTerms.map((term) => (
            <Badge key={term} color="grey">
              {term}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="font-sans text-[12px] font-medium text-grey-500">
          Custom terms ({customTerms.length}/{limits.maxCustomTerms})
        </p>
        {customTerms.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {customTerms.map((term) => (
              <Badge key={term} color="blue">
                {term}
                <button
                  type="button"
                  aria-label={`Remove ${term}`}
                  onClick={() => removeTerm(term)}
                  disabled={disabled}
                  className="ml-1 inline-flex"
                >
                  <X size={12} />
                </button>
              </Badge>
            ))}
          </div>
        )}
        {!atLimit && (
          <div className="flex items-center gap-2">
            <Input
              value={draft}
              disabled={disabled}
              maxLength={60}
              placeholder="e.g. Non-compete radius"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTerm()
                }
              }}
            />
            <Button type="button" variant="ghost" size="sm" onClick={addTerm} disabled={disabled || !draft.trim()}>
              <Plus size={14} /> Add
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
