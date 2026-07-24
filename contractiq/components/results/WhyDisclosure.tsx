'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/** Expandable "Why?" revealing the verbatim source sentence per term. */
export function WhyDisclosure({ sourceSentence }: { sourceSentence: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 self-start font-sans text-[12px] text-grey-500 hover:text-grey-900"
      >
        <ChevronRight size={12} className={cn('transition-transform', open && 'rotate-90')} />
        Why?
      </button>
      {open && (
        <p className="rounded-md bg-subtle px-3 py-2 font-sans text-[12px] leading-[18px] text-grey-700">
          {sourceSentence ? `“${sourceSentence}”` : 'No supporting sentence found — verify manually.'}
        </p>
      )}
    </div>
  )
}
