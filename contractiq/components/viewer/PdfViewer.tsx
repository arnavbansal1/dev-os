'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'

/**
 * Inline PDF viewer using the browser's native PDF renderer via an <iframe> and
 * the `#page=` fragment for navigation (reliable, no worker setup). Remounts on
 * page change so the jump always fires. Falls back to a download link on error.
 */
export function PdfViewer({ signedUrl, targetPage }: { signedUrl: string; targetPage: number }) {
  const [failed, setFailed] = useState(false)
  const src = `${signedUrl}#page=${targetPage}&view=FitH`

  if (failed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-subtle p-6">
        <p className="font-sans text-[12px] text-grey-500">This PDF couldn&apos;t be rendered inline.</p>
        <a
          href={signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 font-sans text-[12px] text-brand"
        >
          <Download size={14} /> Download PDF
        </a>
      </div>
    )
  }

  return (
    <iframe
      key={targetPage}
      src={src}
      title="Contract PDF"
      className="h-full w-full border-0 bg-subtle"
      onError={() => setFailed(true)}
    />
  )
}
