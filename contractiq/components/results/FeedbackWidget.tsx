'use client'

import { useState } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { apiPostJson, ClientApiError } from '@/lib/utils/client-api'

type Rating = 'up' | 'down'

/** Thumbs up/down + optional comment on the results page (US-010). */
export function FeedbackWidget({ contractId }: { contractId: string }) {
  const [rating, setRating] = useState<Rating | null>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!rating) return
    setSubmitting(true)
    setError(null)
    try {
      await apiPostJson('/api/feedback', { contract_id: contractId, rating, comment: comment || undefined })
      setDone(true)
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : 'Could not submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return <p className="font-sans text-[12px] text-green-700">Thanks for the feedback.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-sans text-[12px] font-medium text-grey-500">Was this analysis accurate?</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Thumbs up"
          aria-pressed={rating === 'up'}
          onClick={() => setRating('up')}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-md border transition',
            rating === 'up' ? 'border-green-500 bg-green-50 text-green-700' : 'border-grey-100 text-grey-500 hover:border-grey-200',
          )}
        >
          <ThumbsUp size={16} />
        </button>
        <button
          type="button"
          aria-label="Thumbs down"
          aria-pressed={rating === 'down'}
          onClick={() => setRating('down')}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-md border transition',
            rating === 'down' ? 'border-red-500 bg-red-50 text-red-700' : 'border-grey-100 text-grey-500 hover:border-grey-200',
          )}
        >
          <ThumbsDown size={16} />
        </button>
      </div>
      {rating && (
        <>
          <Textarea
            rows={2}
            value={comment}
            maxLength={1000}
            placeholder="Any comments? (optional)"
            onChange={(e) => setComment(e.target.value)}
            className="text-[12px]"
          />
          <Button size="sm" onClick={submit} loading={submitting} className="self-start">
            Submit feedback
          </Button>
        </>
      )}
      {error && <p className="font-sans text-[12px] text-red-700">{error}</p>}
    </div>
  )
}
