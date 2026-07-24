import { z } from 'zod'
import { limits } from '@/lib/env'

/** NDA | MSA */
export const contractTypeSchema = z.enum(['NDA', 'MSA'])

/** Upload form fields (the File itself is validated imperatively in the route). */
export const uploadSchema = z.object({
  contract_type: contractTypeSchema,
})

/** Custom terms: trimmed, 1–60 chars, de-duped case-insensitively, max 5. */
export const customTermsSchema = z
  .array(z.string().trim().min(1).max(60))
  .max(limits.maxCustomTerms)
  .default([])
  .transform((terms) => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const t of terms) {
      const key = t.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        out.push(t)
      }
    }
    return out
  })

export const processSchema = z.object({
  custom_terms: customTermsSchema.optional(),
})

export const keyTermUpdateSchema = z.object({
  value: z.string().max(2000),
})

export const chatMessageSchema = z.object({
  message: z.string().trim().min(1, 'EMPTY_MESSAGE').max(2000, 'MESSAGE_TOO_LONG'),
})

export const feedbackSchema = z.object({
  contract_id: z.string().uuid(),
  rating: z.enum(['up', 'down']),
  comment: z.string().max(1000).optional(),
})
