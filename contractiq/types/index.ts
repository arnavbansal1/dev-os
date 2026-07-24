/**
 * Core domain types for ContractIQ (foundation).
 * Mirrors the database design in docs/engineering/engineering-doc.md §7.
 * Feature code in Stage 4 builds on these; no business logic here.
 */

export type ContractType = 'NDA' | 'MSA'

export type ContractStatus = 'uploaded' | 'processing' | 'complete' | 'error'

export interface Contract {
  id: string
  user_id: string
  name: string
  contract_type: ContractType
  contract_text: string // full extracted text with [PAGE N] markers
  page_count: number
  token_count: number
  file_path: string | null // null when Storage upload failed (viewer hidden)
  status: ContractStatus
  created_at: string
  last_accessed_at: string
}

export interface KeyTerm {
  id: string
  contract_id: string
  user_id: string
  term_name: string
  value: string
  ai_original_value: string // preserved for the correction feedback loop
  page_number: number // 1-indexed
  confidence_score: number // 0.0–1.0
  source_sentence: string
  is_edited: boolean
  is_manual: boolean // true for user-added custom terms
  created_at: string
}

export type ChatRole = 'user' | 'assistant'

/** Where an assistant answer was sourced from (conversation memory layer). */
export type ChatSource = 'contract' | 'history' | 'both'

export interface ChatMessage {
  id: string
  session_id: string
  user_id: string
  role: ChatRole
  content: string
  source: ChatSource | null // attribution for assistant turns; null for user turns & legacy rows
  created_at: string
}

export interface ChatSession {
  id: string
  contract_id: string
  user_id: string
  created_at: string
}

export type FeedbackRating = 'up' | 'down'

export interface UserFeedback {
  id: string
  contract_id: string
  user_id: string
  rating: FeedbackRating
  comment: string | null
  created_at: string
}

/** Standard error envelope returned by all API routes (engineering-doc §6/§9). */
export interface ApiError {
  error: {
    code: string
    message: string
    retryable: boolean
  }
}
