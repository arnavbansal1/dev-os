import { getOpenAI, withRetry, hashUserId } from '@/lib/openai/client'
import { serverEnv } from '@/lib/env'
import {
  buildChatSystemPrompt,
  classifyQuery,
  extractPageCitation,
  retrievalPlanFor,
  NOT_FOUND_REPLY,
  type QueryType,
} from '@/lib/prompts/chat.prompt'
import type { ChatMessage } from '@/types'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

export interface ChatAnswer {
  content: string
  pageCitation: number | null
  /** Where the answer was sourced from — drives UI attribution. */
  source: QueryType
}

/**
 * Conversation Memory Layer (contract-chat.md). Classifies the question, retrieves
 * only the context that classification calls for, and answers with a matching
 * system prompt:
 *   - contract → contract text + last 10 turns, document-only prompt
 *   - history  → conversation only (no contract) + up to 20 turns
 *   - both     → contract text + last 10 turns, attribute each fact to its source
 *
 * `history` MUST be the conversation loaded BEFORE the current `userMessage` was
 * persisted, so the classifier never mistakes the new question for prior history.
 */
export async function chatWithContract(
  contractText: string,
  history: ChatMessage[],
  userMessage: string,
  userId: string,
): Promise<ChatAnswer> {
  const openai = getOpenAI()

  const queryType = classifyQuery(userMessage, history.length)
  const plan = retrievalPlanFor(queryType)

  // Retrieve only the context this classification calls for.
  const recentHistory = plan.maxTurns > 0 ? history.slice(-plan.maxTurns) : []
  const contextText = plan.includeContract ? contractText : ''

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: buildChatSystemPrompt(contextText, queryType) },
    ...recentHistory.map((m) => ({ role: m.role, content: m.content }) as ChatCompletionMessageParam),
    { role: 'user', content: userMessage },
  ]

  const completion = await withRetry(() =>
    openai.chat.completions.create({
      model: serverEnv.openaiModel,
      messages,
      temperature: serverEnv.openaiTempChat,
      max_tokens: serverEnv.openaiMaxTokensChat,
      user: hashUserId(userId),
    }),
  )

  let content = completion.choices[0]?.message?.content?.trim() || NOT_FOUND_REPLY
  const pageCitation = extractPageCitation(content)

  // Soft-enforce the page citation only when the contract is actually a source and
  // an answer was found. History-only answers carry no page reference.
  if (plan.includeContract && !pageCitation && content !== NOT_FOUND_REPLY) {
    content = `${content} [Page ?]`
  }

  return { content, pageCitation, source: queryType }
}
