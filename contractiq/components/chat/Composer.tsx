'use client'

import { useState } from 'react'
import { SendHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'

export function Composer({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void
  disabled?: boolean
}) {
  const [text, setText] = useState('')

  function submit() {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
  }

  return (
    <div className="flex items-end gap-2 border-t border-grey-100 p-3">
      <Textarea
        rows={2}
        value={text}
        maxLength={2000}
        disabled={disabled}
        placeholder="Ask about this contract…"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
        }}
        className="text-[12px]"
      />
      <Button size="sm" onClick={submit} disabled={disabled || !text.trim()} aria-label="Send">
        <SendHorizontal size={14} />
      </Button>
    </div>
  )
}
