import { getOpenAI, withRetry, hashUserId } from '@/lib/openai/client'
import { serverEnv } from '@/lib/env'
import { buildExtractionMessages, JSON_REPAIR_INSTRUCTION } from '@/lib/prompts/extraction.prompt'
import { AppError } from '@/lib/utils/errors'
import type { ContractType } from '@/types'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

export interface ExtractedTerm {
  term_name: string
  value: string
  page_number: number | null
  confidence_score: number
  source_sentence: string
}

function coerceTerm(raw: unknown): ExtractedTerm | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.term_name !== 'string') return null
  const page =
    typeof r.page_number === 'number' && Number.isFinite(r.page_number) && r.page_number >= 1
      ? Math.floor(r.page_number)
      : null
  const confidenceRaw = typeof r.confidence_score === 'number' ? r.confidence_score : 0
  return {
    term_name: r.term_name,
    value: typeof r.value === 'string' ? r.value : 'Not specified',
    page_number: page,
    confidence_score: Math.min(1, Math.max(0, confidenceRaw)),
    source_sentence: typeof r.source_sentence === 'string' ? r.source_sentence : '',
  }
}

function parseTerms(content: string | null): ExtractedTerm[] | null {
  if (!content) return null
  try {
    const parsed = JSON.parse(content) as { terms?: unknown }
    if (!parsed || !Array.isArray(parsed.terms)) return null
    return parsed.terms.map(coerceTerm).filter((t): t is ExtractedTerm => t !== null)
  } catch {
    return null
  }
}

/**
 * Extract standard + custom key terms from contract text via GPT-4o (JSON mode).
 * One automatic JSON-repair retry before failing (key-term-extraction.md).
 */
export async function extractKeyTerms(
  contractText: string,
  contractType: ContractType,
  termNames: string[],
  userId: string,
): Promise<ExtractedTerm[]> {
  const openai = getOpenAI()
  const { system, user } = buildExtractionMessages(contractText, contractType, termNames)

  const baseMessages: ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]

  const call = (messages: ChatCompletionMessageParam[]) =>
    withRetry(() =>
      openai.chat.completions.create({
        model: serverEnv.openaiModel,
        messages,
        temperature: serverEnv.openaiTempExtract,
        max_tokens: serverEnv.openaiMaxTokensExtract,
        response_format: { type: 'json_object' },
        user: hashUserId(userId),
      }),
    )

  const first = await call(baseMessages)
  const firstContent = first.choices[0]?.message?.content ?? null
  let terms = parseTerms(firstContent)

  if (!terms) {
    const repair = await call([
      ...baseMessages,
      { role: 'assistant', content: firstContent ?? '' },
      { role: 'user', content: JSON_REPAIR_INSTRUCTION },
    ])
    terms = parseTerms(repair.choices[0]?.message?.content ?? null)
  }

  if (!terms) throw new AppError('EXTRACTION_PARSE_FAILED')
  return terms
}
