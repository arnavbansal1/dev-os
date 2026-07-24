import type { ContractType } from '@/types'

/** Standard key-term libraries per contract type (key-term-extraction.md / PRD Flow 3). */
export const STANDARD_TERMS: Record<ContractType, string[]> = {
  NDA: [
    'Parties',
    'Effective Date',
    'Confidentiality Obligations',
    'Permitted Disclosures',
    'Term & Duration',
    'Governing Law',
    'Jurisdiction',
    'IP Ownership',
    'Non-Solicitation',
    'Breach & Remedy',
  ],
  MSA: [
    'Parties',
    'Service Scope',
    'Payment Terms',
    'Invoice Schedule',
    'Late Payment Penalty',
    'Liability Cap',
    'Indemnification',
    'IP Ownership',
    'Termination Clause',
    'Governing Law',
    'Dispute Resolution',
    'Notice Period',
  ],
}

export function standardTermsFor(type: ContractType): string[] {
  return STANDARD_TERMS[type]
}
