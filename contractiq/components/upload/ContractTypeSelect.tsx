'use client'

import type { ContractType } from '@/types'
import { Select } from '@/components/ui/Select'
import { Label } from '@/components/ui/Input'

export function ContractTypeSelect({
  value,
  onChange,
  disabled,
}: {
  value: ContractType
  onChange: (v: ContractType) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="contract-type">Contract type</Label>
      <Select
        id="contract-type"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as ContractType)}
      >
        <option value="NDA">NDA — Non-Disclosure Agreement</option>
        <option value="MSA">MSA — Master Service Agreement</option>
      </Select>
    </div>
  )
}
