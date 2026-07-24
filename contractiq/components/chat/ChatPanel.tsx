'use client'

import { useChat } from '@/hooks/useChat'
import { MessageList } from './MessageList'
import { Composer } from './Composer'

/**
 * Contract chat (US-007/012). Grounded Q&A with persisted history and
 * clickable page citations that drive the document viewer.
 */
export function ChatPanel({
  contractId,
  enabled,
  onNavigate,
}: {
  contractId: string
  enabled: boolean
  onNavigate: (page: number) => void
}) {
  const { messages, sending, error, send } = useChat(contractId, enabled)

  if (!enabled) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <p className="font-sans text-[12px] text-grey-500">
          Finish processing to chat with this contract.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <MessageList messages={messages} sending={sending} onNavigate={onNavigate} />
      {error && (
        <p className="px-4 pb-1 font-sans text-[12px] text-red-700" role="alert">
          {error}
        </p>
      )}
      <Composer onSend={send} disabled={sending} />
    </div>
  )
}
