'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpDown, Trash2 } from 'lucide-react'
import type { Contract, ContractStatus } from '@/types'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import { apiDelete, ClientApiError } from '@/lib/utils/client-api'

export type ContractListItem = Pick<
  Contract,
  'id' | 'name' | 'contract_type' | 'status' | 'created_at'
>

type SortKey = 'created_at' | 'name' | 'contract_type'
type SortDir = 'asc' | 'desc'

const STATUS_BADGE: Record<ContractStatus, { color: 'grey' | 'yellow' | 'green' | 'red'; label: string }> = {
  uploaded: { color: 'grey', label: 'Uploaded' },
  processing: { color: 'yellow', label: 'Processing' },
  complete: { color: 'green', label: 'Complete' },
  error: { color: 'red', label: 'Error' },
}

export function ContractTable({ initialContracts }: { initialContracts: ContractListItem[] }) {
  const router = useRouter()
  const [contracts, setContracts] = useState(initialContracts)
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sorted = useMemo(() => {
    const copy = [...contracts]
    copy.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortKey === 'contract_type') cmp = a.contract_type.localeCompare(b.contract_type)
      else cmp = a.created_at.localeCompare(b.created_at)
      if (cmp === 0) cmp = a.created_at.localeCompare(b.created_at) // stable secondary sort
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [contracts, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  async function remove(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!window.confirm("Delete this contract and all its data? This can't be undone.")) return
    setDeletingId(id)
    setError(null)
    const prev = contracts
    setContracts((c) => c.filter((x) => x.id !== id)) // optimistic
    try {
      await apiDelete(`/api/contracts/${id}`)
    } catch (err) {
      setContracts(prev) // roll back
      setError(err instanceof ClientApiError ? err.message : 'Could not delete. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="font-sans text-[12px] text-red-700">{error}</p>}
      <Card className="overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-grey-100 text-left">
              <Th onClick={() => toggleSort('name')} active={sortKey === 'name'}>Name</Th>
              <Th onClick={() => toggleSort('contract_type')} active={sortKey === 'contract_type'}>Type</Th>
              <Th onClick={() => toggleSort('created_at')} active={sortKey === 'created_at'}>Date</Th>
              <th className="px-4 py-3 font-sans text-[12px] font-medium text-grey-500">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => {
              const badge = STATUS_BADGE[c.status]
              return (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/contracts/${c.id}`)}
                  className="cursor-pointer border-b border-grey-50 last:border-b-0 hover:bg-subtle"
                >
                  <td className="px-4 py-3 font-sans text-[16px] text-grey-900">{c.name}</td>
                  <td className="px-4 py-3">
                    <Badge color="blue">{c.contract_type}</Badge>
                  </td>
                  <td className="px-4 py-3 font-sans text-[12px] text-grey-500">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={badge.color}>{badge.label}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      aria-label={`Delete ${c.name}`}
                      onClick={(e) => remove(e, c.id)}
                      disabled={deletingId === c.id}
                      className="inline-flex text-grey-300 hover:text-red-600 disabled:opacity-40"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

function Th({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode
  onClick: () => void
  active: boolean
}) {
  return (
    <th className="px-4 py-3">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1 font-sans text-[12px] font-medium',
          active ? 'text-grey-900' : 'text-grey-500',
        )}
      >
        {children}
        <ArrowUpDown size={12} />
      </button>
    </th>
  )
}
