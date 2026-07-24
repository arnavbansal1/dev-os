// Import the parser implementation directly to avoid pdf-parse's index.js debug
// harness, which tries to read a sample file at import time.
import pdfParse from 'pdf-parse/lib/pdf-parse.js'

export interface ExtractedPdf {
  /** Full text with a `[PAGE N]` marker prefixed before each page. */
  text: string
  pageCount: number
}

/**
 * Extract text from a PDF buffer, inserting `[PAGE N]` markers so downstream
 * extraction and chat can attribute values to pages. Runs once at upload.
 * Throws on unreadable / encrypted / image-only PDFs (caller maps to a friendly error).
 */
export async function extractPdf(buffer: Buffer): Promise<ExtractedPdf> {
  let pageIndex = 0

  // Custom page renderer: replicates pdf-parse's default line reconstruction and
  // prefixes a 1-indexed page marker to each page's text.
  const renderPage = (pageData: {
    getTextContent: (opts: { normalizeWhitespace: boolean; disableCombineTextItems: boolean }) => Promise<{
      items: Array<{ str: string; transform: number[] }>
    }>
  }): Promise<string> => {
    pageIndex += 1
    const marker = `\n[PAGE ${pageIndex}]\n`
    return pageData
      .getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false })
      .then((content) => {
        let lastY: number | undefined
        let text = ''
        for (const item of content.items) {
          const y = item.transform[5]
          if (lastY === y || lastY === undefined) {
            text += item.str
          } else {
            text += '\n' + item.str
          }
          lastY = y
        }
        return marker + text
      })
  }

  const result = await pdfParse(buffer, { pagerender: renderPage })
  return {
    text: result.text.trim(),
    pageCount: result.numpages ?? pageIndex,
  }
}
