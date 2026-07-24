'use client'

import { useRef, useState } from 'react'
import { UploadCloud, FileText } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { limits } from '@/lib/env'

/** Drag-drop / file-pick zone with client-side type + size pre-checks. */
export function UploadZone({
  onFile,
  disabled,
}: {
  onFile: (file: File) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  function validateAndSend(file: File | undefined) {
    setLocalError(null)
    if (!file) return
    if (file.type !== 'application/pdf') {
      setLocalError('Only PDF files are supported.')
      return
    }
    if (file.size > limits.maxUploadBytes) {
      setLocalError('The file is larger than 10 MB.')
      return
    }
    onFile(file)
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (!disabled) validateAndSend(e.dataTransfer.files?.[0])
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-16 transition',
          dragOver ? 'border-brand bg-blue-50' : 'border-grey-200 bg-white hover:border-grey-300',
          disabled && 'pointer-events-none opacity-60',
        )}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-md bg-blue-50">
          <UploadCloud size={22} className="text-brand" />
        </span>
        <span className="font-sans text-[16px] font-medium text-grey-900">
          Drag &amp; drop a PDF, or click to browse
        </span>
        <span className="flex items-center gap-1 font-sans text-[12px] text-grey-500">
          <FileText size={14} /> Text-layer PDFs · up to 20 pages · max 10 MB
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => validateAndSend(e.target.files?.[0])}
      />

      {localError && <p className="font-sans text-[12px] leading-[18px] text-red-700">{localError}</p>}
    </div>
  )
}
