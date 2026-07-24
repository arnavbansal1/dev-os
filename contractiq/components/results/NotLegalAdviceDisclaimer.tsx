import { Info } from 'lucide-react'

/** Persistent disclaimer required on every results page (PRD §9). */
export function NotLegalAdviceDisclaimer() {
  return (
    <div className="flex items-start gap-2 rounded-md border border-grey-100 bg-subtle px-4 py-3">
      <Info size={16} className="mt-0.5 shrink-0 text-grey-500" />
      <p className="font-sans text-[12px] leading-[18px] text-grey-500">
        This is an AI-assisted review tool, not legal advice. Always verify critical terms with a
        qualified lawyer.
      </p>
    </div>
  )
}
