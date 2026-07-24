/**
 * Cheap, dependency-free heuristics for the upload guards (pdf-upload-extraction.md).
 * Exact token counts aren't needed — only a reliable upper-bound gate at 15k.
 */

/** Approximate token count (~4 chars/token for English legal prose). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/** Word count for the scanned-PDF guard (text < 100 words => likely image PDF). */
export function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}
