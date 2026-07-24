import Link from 'next/link'
import { FileText } from 'lucide-react'
import { Card } from '@/components/ui/Card'

export function EmptyState() {
  return (
    <Card className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-md bg-blue-50">
        <FileText size={22} className="text-brand" />
      </span>
      <div>
        <p className="font-sans text-[16px] font-medium text-grey-900">No contracts reviewed yet</p>
        <p className="mt-1 font-sans text-[12px] text-grey-500">
          Upload your first contract to begin.
        </p>
      </div>
      <Link href="/review" className="btn-primary">
        Review a Contract
      </Link>
    </Card>
  )
}
