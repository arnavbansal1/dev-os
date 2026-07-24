import { Check } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Spinner } from '@/components/ui/Spinner'

export type StepState = 'done' | 'active' | 'pending'
export interface Step {
  label: string
  state: StepState
}

/** Three-step processing indicator (extract → analyse → compile). */
export function ProgressStepper({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, i) => (
        <li key={i} className="flex items-center gap-3">
          <span
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full border text-[12px]',
              step.state === 'done' && 'border-green-500 bg-green-50 text-green-700',
              step.state === 'active' && 'border-brand bg-blue-50 text-brand',
              step.state === 'pending' && 'border-grey-100 bg-white text-grey-300',
            )}
          >
            {step.state === 'done' ? (
              <Check size={14} />
            ) : step.state === 'active' ? (
              <Spinner size={14} />
            ) : (
              i + 1
            )}
          </span>
          <span
            className={cn(
              'font-sans text-[16px]',
              step.state === 'pending' ? 'text-grey-400' : 'text-grey-900',
            )}
          >
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  )
}
