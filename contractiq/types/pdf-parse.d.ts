/**
 * Type declaration for the deep import `pdf-parse/lib/pdf-parse.js`, which we use
 * to avoid the package's index.js debug harness. The published @types/pdf-parse
 * only declares the package root.
 */
declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfParseResult {
    numpages: number
    numrender: number
    info: unknown
    metadata: unknown
    version: string
    text: string
  }

  interface PdfParseOptions {
    pagerender?: (pageData: {
      getTextContent: (opts: {
        normalizeWhitespace: boolean
        disableCombineTextItems: boolean
      }) => Promise<{ items: Array<{ str: string; transform: number[] }> }>
    }) => Promise<string>
    max?: number
    version?: string
  }

  function pdfParse(dataBuffer: Buffer, options?: PdfParseOptions): Promise<PdfParseResult>
  export default pdfParse
}
