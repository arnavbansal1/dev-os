'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ChatMessage } from '@/types'
import { apiGet, apiPostJson, ClientApiError } from '@/lib/utils/client-api'

type UiMessage = Pick<ChatMessage, 'role' | 'content'> & {
  id: string
  created_at?: string
  source?: ChatMessage['source']
}

/** Manages chat history load + send for a contract (contract-chat.md). */
export function useChat(contractId: string, enabled: boolean) {
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let active = true
    apiGet<{ messages: UiMessage[] }>(`/api/contracts/${contractId}/messages`)
      .then((res) => {
        if (active) setMessages(res.messages)
      })
      .catch(() => {
        /* history hydration failure is non-fatal */
      })
      .finally(() => active && setHydrated(true))
    return () => {
      active = false
    }
  }, [contractId, enabled])

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || sending) return
      setError(null)
      setSending(true)
      const optimistic: UiMessage = { id: `local-${Date.now()}`, role: 'user', content: trimmed }
      setMessages((prev) => [...prev, optimistic])
      try {
        const { message } = await apiPostJson<{ message: UiMessage }>(
          `/api/contracts/${contractId}/chat`,
          { message: trimmed },
        )
        setMessages((prev) => [...prev, message])
      } catch (err) {
        setError(err instanceof ClientApiError ? err.message : 'Message failed. Please try again.')
        // Roll back the optimistic user message on failure (server didn't persist the turn).
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      } finally {
        setSending(false)
      }
    },
    [contractId, sending],
  )

  return { messages, sending, error, hydrated, send }
}
