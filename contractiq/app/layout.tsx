import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ContractIQ — Understand any NDA or MSA in minutes',
  description:
    'Upload an NDA or MSA and get the key terms extracted automatically — with page references, confidence scores, and a chat grounded in your document. Not legal advice.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
