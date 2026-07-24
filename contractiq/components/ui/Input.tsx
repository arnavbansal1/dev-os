import { forwardRef } from 'react'
import { cn } from '@/lib/utils/cn'

const fieldBase =
  'w-full font-sans text-[16px] leading-6 text-grey-900 bg-white rounded-md border border-grey-100 ' +
  'px-3 py-2 placeholder:text-grey-300 transition ' +
  'focus:outline focus:outline-2 focus:outline-offset-0 focus:outline-brand focus:border-brand ' +
  'disabled:bg-subtle disabled:text-grey-400'

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(fieldBase, className)} {...props} />
  },
)

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(fieldBase, 'resize-y', className)} {...props} />
  },
)

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="font-sans text-[12px] leading-[18px] font-medium text-grey-500">
      {children}
    </label>
  )
}

export function FieldError({ children }: { children: React.ReactNode }) {
  if (!children) return null
  return <p className="font-sans text-[12px] leading-[18px] text-red-700">{children}</p>
}
