'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import type { KeyTerm } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Tooltip } from '@/components/ui/Tooltip'
import { ConfidenceBadge } from './ConfidenceBadge'
import { WhyDisclosure } from './WhyDisclosure'
import { InlineEditor } from './InlineEditor'
import { confidenceBand, LOW_CONFIDENCE_TOOLTIP } from '@/lib/utils/confidence'
import { apiPatchJson, ClientApiError } from '@/lib/utils/client-api'

export function TermRow({
  term,
  onNavigate,
  onUpdated,
}: {
  term: KeyTerm
  onNavigate: (page: number) => void
  onUpdated: (term: KeyTerm) => void
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isLow = confidenceBand(term.confidence_score) === 'low'

  async function save(value: string) {
    setSaving(true)
    setError(null)
    try {
      const { key_term } = await apiPatchJson<{ key_term: KeyTerm }>(`/api/key-terms/${term.id}`, { value })
      onUpdated(key_term)
      setEditing(false)
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : 'Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 border-b border-grey-100 py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-sans text-[16px] font-medium text-grey-900">{term.term_name}</span>
          {term.is_manual && <Badge color="blue">Custom</Badge>}
          {term.is_edited && <Badge color="grey">Edited</Badge>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isLow ? (
            <Tooltip label={LOW_CONFIDENCE_TOOLTIP}>
              <ConfidenceBadge score={term.confidence_score} />
            </Tooltip>
          ) : (
            <ConfidenceBadge score={term.confidence_score} />
          )}
        </div>
      </div>

      {editing ? (
        <InlineEditor
          initialValue={term.value}
          saving={saving}
          onSave={save}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="group flex items-start gap-2 self-start text-left"
        >
          <span className="font-sans text-[16px] text-grey-900">{term.value || '—'}</span>
          <Pencil size={14} className="mt-1 text-grey-300 opacity-0 transition group-hover:opacity-100" />
        </button>
      )}

      {error && <p className="font-sans text-[12px] text-red-700">{error}</p>}

      <div className="flex items-center justify-between gap-3">
        <WhyDisclosure sourceSentence={term.source_sentence} />
        {term.page_number ? (
          <button
            type="button"
            onClick={() => onNavigate(term.page_number as number)}
            className="font-sans text-[12px] text-brand hover:underline"
          >
            Page {term.page_number} →
          </button>
        ) : (
          <span className="font-sans text-[12px] text-grey-300">—</span>
        )}
      </div>
    </div>
  )
}
