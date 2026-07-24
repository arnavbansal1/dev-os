/**
 * Client-safe helpers for the `[PAGE N]` marker convention used in
 * contracts.contract_text. No server-only imports here so the TextViewer
 * (a Client Component) can use it.
 */

export const PAGE_MARKER = /\[PAGE\s+(\d+)\]/gi

export interface ContractPage {
  page: number
  text: string
}

/** Split marked contract text into per-page sections, ordered by page number. */
export function splitByPageMarkers(text: string): ContractPage[] {
  if (!text) return []
  const pages: ContractPage[] = []
  const matches = [...text.matchAll(PAGE_MARKER)]

  if (matches.length === 0) {
    return [{ page: 1, text: text.trim() }]
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i]
    const pageNum = Number.parseInt(current[1], 10)
    const start = (current.index ?? 0) + current[0].length
    const end = i + 1 < matches.length ? matches[i + 1].index ?? text.length : text.length
    pages.push({ page: pageNum, text: text.slice(start, end).trim() })
  }
  return pages
}
