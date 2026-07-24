'use client'

import { Fragment } from 'react'

/**
 * Renders assistant text, turning every [Page X] citation into a clickable chip
 * that navigates the document viewer to that page.
 */
export function CitedContent({
  content,
  onNavigate,
}: {
  content: string
  onNavigate: (page: number) => void
}) {
  const parts = content.split(/(\[Page\s+\d+\??\])/gi)
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/\[Page\s+(\d+)\??\]/i)
        if (match) {
          const page = Number.parseInt(match[1], 10)
          if (Number.isFinite(page)) {
            return (
              <button
                key={i}
                type="button"
                onClick={() => onNavigate(page)}
                className="mx-0.5 inline-flex items-center rounded-sm bg-blue-50 px-1.5 py-0.5 font-sans text-[12px] font-medium text-blue-700 hover:bg-blue-100"
              >
                Page {page}
              </button>
            )
          }
        }
        return <Fragment key={i}>{part}</Fragment>
      })}
    </>
  )
}
