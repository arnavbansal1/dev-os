'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { splitByPageMarkers } from '@/lib/utils/pages'

/**
 * Paginated text fallback for when Storage is unavailable (FR-06). Parses
 * [PAGE N] markers, renders each page as a labelled section, and responds to
 * targetPage changes with a scroll + highlight flash — identical navigation UX
 * to the PDF viewer.
 */
export function TextViewer({ contractText, targetPage }: { contractText: string; targetPage: number }) {
  const pages = useMemo(() => splitByPageMarkers(contractText), [contractText])
  const [flashPage, setFlashPage] = useState<number | null>(null)

  useEffect(() => {
    const el = document.getElementById(`page-${targetPage}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setFlashPage(targetPage)
    const t = setTimeout(() => setFlashPage(null), 800)
    return () => clearTimeout(t)
  }, [targetPage])

  return (
    <div className="h-full overflow-y-auto bg-subtle p-4">
      <div className="mx-auto flex max-w-[720px] flex-col gap-4">
        {pages.map(({ page, text }) => (
          <section
            key={page}
            id={`page-${page}`}
            className={cn(
              'scroll-mt-4 rounded-lg border border-grey-100 bg-white p-6 transition-colors duration-300',
              flashPage === page && 'bg-blue-50',
            )}
          >
            <p className="mb-2 font-sans text-[12px] font-medium text-grey-400">Page {page}</p>
            <pre className="whitespace-pre-wrap font-sans text-[12px] leading-[18px] text-grey-900">
              {text}
            </pre>
          </section>
        ))}
      </div>
    </div>
  )
}
