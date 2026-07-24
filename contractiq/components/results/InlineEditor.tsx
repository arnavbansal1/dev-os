'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

/** Inline text editor for a key-term value (US-009). */
export function InlineEditor({
  initialValue,
  onSave,
  onCancel,
  saving,
}: {
  initialValue: string
  onSave: (value: string) => void
  onCancel: () => void
  saving: boolean
}) {
  const [value, setValue] = useState(initialValue)

  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        value={value}
        maxLength={2000}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave(value)
          if (e.key === 'Escape') onCancel()
        }}
      />
      <Button size="sm" onClick={() => onSave(value)} loading={saving}>
        Save
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
        Cancel
      </Button>
    </div>
  )
}
