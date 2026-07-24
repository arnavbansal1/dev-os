'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import type { ContractType } from '@/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ContractTypeSelect } from './ContractTypeSelect'
import { UploadZone } from './UploadZone'
import { TermPreviewList } from './TermPreviewList'
import { ProgressStepper, type Step } from '@/components/results/ProgressStepper'
import { apiPostForm, apiPostJson, ClientApiError } from '@/lib/utils/client-api'

interface UploadResult {
  contract_id: string
  standard_terms: string[]
  file_available: boolean
}

type Phase = 'select' | 'uploading' | 'preview' | 'processing'

export function ReviewFlow() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('select')
  const [contractType, setContractType] = useState<ContractType>('NDA')
  const [uploaded, setUploaded] = useState<UploadResult | null>(null)
  const [customTerms, setCustomTerms] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)
    setPhase('uploading')
    try {
      const form = new FormData()
      form.set('file', file)
      form.set('contract_type', contractType)
      const result = await apiPostForm<UploadResult>('/api/contracts/upload', form)
      setUploaded(result)
      setPhase('preview')
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : 'Upload failed. Please try again.')
      setPhase('select')
    }
  }

  async function handleProcess() {
    if (!uploaded) return
    setError(null)
    setPhase('processing')
    try {
      await apiPostJson(`/api/contracts/${uploaded.contract_id}/process`, { custom_terms: customTerms })
      router.push(`/contracts/${uploaded.contract_id}`)
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : 'Processing failed. Please try again.')
      setPhase('preview')
    }
  }

  const steps: Step[] = [
    { label: 'Extracting text', state: 'done' },
    { label: 'Analysing with AI', state: 'active' },
    { label: 'Compiling results', state: 'pending' },
  ]

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6">
      <div>
        <h1 className="font-sans text-[24px] font-medium leading-8 text-grey-900">Review a contract</h1>
        <p className="mt-1 font-sans text-[12px] text-grey-500">
          Upload an NDA or MSA to extract its key terms.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle size={16} className="mt-0.5 text-red-700" />
          <p className="font-sans text-[12px] leading-[18px] text-red-700">{error}</p>
        </div>
      )}

      {phase === 'processing' ? (
        <Card className="p-8">
          <p className="mb-4 font-sans text-[16px] font-medium text-grey-900">Processing your contract…</p>
          <ProgressStepper steps={steps} />
        </Card>
      ) : (
        <Card className="flex flex-col gap-6 p-8">
          <ContractTypeSelect
            value={contractType}
            onChange={setContractType}
            disabled={phase !== 'select'}
          />

          {phase === 'select' || phase === 'uploading' ? (
            <UploadZone onFile={handleFile} disabled={phase === 'uploading'} />
          ) : null}

          {uploaded && (phase === 'preview') && (
            <>
              <TermPreviewList
                standardTerms={uploaded.standard_terms}
                customTerms={customTerms}
                onCustomTermsChange={setCustomTerms}
              />
              <div className="flex justify-end">
                <Button onClick={handleProcess}>Process contract</Button>
              </div>
            </>
          )}

          {phase === 'uploading' && (
            <p className="font-sans text-[12px] text-grey-500">Extracting text from your PDF…</p>
          )}
        </Card>
      )}
    </div>
  )
}
