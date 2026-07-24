'use client'

import { useEffect, useRef } from 'react'
import { FileText, MessageSquare, Layers } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { SOURCE_LABEL, type QueryType } from '@/lib/prompts/chat.prompt'
import { CitedContent } from './Citation'

export interface UiMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  source?: QueryType | null
}

const SOURCE_ICON: Record<QueryType, typeof FileText> = {
  contract: FileText,
  history: MessageSquare,
  both: Layers,
}

/** Small pill under an assistant answer telling the user where it came from. */
function SourceBadge({ source }: { source: QueryType }) {
  const Icon = SOURCE_ICON[source]
  return (
    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-subtle px-2 py-0.5 font-sans text-[10px] font-medium text-grey-500">
      <Icon size={11} aria-hidden />
      {SOURCE_LABEL[source]}
    </span>
  )
}

export function MessageList({
  messages,
  sending,
  onNavigate,
}: {
  messages: UiMessage[]
  sending: boolean
  onNavigate: (page: number) => void
}) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  if (messages.length === 0 && !sending) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center">
        <p className="font-sans text-[12px] leading-[18px] text-grey-500">
          Ask a question about this contract — e.g. “Is there an auto-renewal clause?”
          <br />
          Answers come only from your document.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
      {messages.map((m) => (
        <div
          key={m.id}
          className={cn('flex flex-col', m.role === 'user' ? 'items-end' : 'items-start')}
        >
          <div
            className={cn(
              'max-w-[85%] rounded-lg px-3 py-2 font-sans text-[12px] leading-[18px]',
              m.role === 'user' ? 'bg-brand text-white' : 'bg-subtle text-grey-900',
            )}
          >
            {m.role === 'assistant' ? (
              <CitedContent content={m.content} onNavigate={onNavigate} />
            ) : (
              m.content
            )}
          </div>
          {m.role === 'assistant' && m.source && <SourceBadge source={m.source} />}
        </div>
      ))}
      {sending && (
        <div className="flex justify-start">
          <div className="rounded-lg bg-subtle px-3 py-2 font-sans text-[12px] text-grey-400">Thinking…</div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  )
}
