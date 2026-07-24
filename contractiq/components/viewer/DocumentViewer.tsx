'use client'

import { Info } from 'lucide-react'
import { PdfViewer } from './PdfViewer'
import { TextViewer } from './TextViewer'

/**
 * Picks the renderer: the PDF.js-style inline viewer when a signed URL is
 * available, otherwise the paginated text fallback (FR-06). Both respond to
 * `targetPage` from key-term / citation clicks.
 */
export function DocumentViewer({
  signedUrl,
  contractText,
  targetPage,
}: {
  signedUrl: string | null
  contractText: string
  targetPage: number
}) {
  return (
    <div className="flex h-full flex-col">
      {!signedUrl && (
        <div className="flex items-center gap-2 border-b border-grey-100 bg-yellow-50 px-4 py-2">
          <Info size={14} className="text-yellow-800" />
          <p className="font-sans text-[12px] text-yellow-800">
            PDF preview unavailable — showing extracted text. Analysis is unaffected.
          </p>
        </div>
      )}
      <div className="min-h-0 flex-1">
        {signedUrl ? (
          <PdfViewer signedUrl={signedUrl} targetPage={targetPage} />
        ) : (
          <TextViewer contractText={contractText} targetPage={targetPage} />
        )}
      </div>
    </div>
  )
}
