'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, FileText, ListChecks, MessageSquare } from 'lucide-react'
import type { Contract, KeyTerm } from '@/types'
import { cn } from '@/lib/utils/cn'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DocumentViewer } from '@/components/viewer/DocumentViewer'
import { KeyTermsPanel } from './KeyTermsPanel'
import { NotLegalAdviceDisclaimer } from './NotLegalAdviceDisclaimer'
import { FeedbackWidget } from './FeedbackWidget'
import { ProgressStepper, type Step } from './ProgressStepper'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { apiGet, apiPostJson, ClientApiError } from '@/lib/utils/client-api'

interface ResultsPayload {
  contract: Contract
  key_terms: KeyTerm[]
  signed_url: string | null
  page_count: number
}

/** Which content the right column shows (both mobile and desktop). */
type Panel = 'terms' | 'chat'
/** On mobile, whether the document or the panel column is showing. */
type MobileView = 'document' | 'panel'

export function ResultsView({ initial }: { initial: ResultsPayload }) {
  const [contract, setContract] = useState<Contract>(initial.contract)
  const [keyTerms, setKeyTerms] = useState<KeyTerm[]>(initial.key_terms)
  const [signedUrl] = useState<string | null>(initial.signed_url)
  const [targetPage, setTargetPage] = useState(1)
  const [panel, setPanel] = useState<Panel>('terms')
  const [mobileView, setMobileView] = useState<MobileView>('panel')
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)

  const isProcessing = contract.status === 'processing' || contract.status === 'uploaded'
  const isError = contract.status === 'error'
  const isComplete = contract.status === 'complete'

  // Poll while processing.
  useEffect(() => {
    if (!isProcessing) return
    let active = true
    const interval = setInterval(async () => {
      try {
        const res = await apiGet<ResultsPayload>(`/api/contracts/${contract.id}`)
        if (!active) return
        setContract(res.contract)
        setKeyTerms(res.key_terms)
        if (res.contract.status !== 'processing' && res.contract.status !== 'uploaded') {
          clearInterval(interval)
        }
      } catch {
        /* transient poll failure — keep polling */
      }
    }, 2500)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [isProcessing, contract.id])

  const navigate = useCallback((page: number) => {
    setTargetPage(Math.max(1, page))
    setMobileView('document')
  }, [])

  const onTermUpdated = useCallback((updated: KeyTerm) => {
    setKeyTerms((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
  }, [])

  async function retry() {
    setRetrying(true)
    setRetryError(null)
    try {
      const res = await apiPostJson<{ key_terms: KeyTerm[] }>(`/api/contracts/${contract.id}/process`, {
        custom_terms: [],
      })
      setKeyTerms(res.key_terms)
      setContract((c) => ({ ...c, status: 'complete' }))
    } catch (err) {
      setRetryError(err instanceof ClientApiError ? err.message : 'Retry failed. Please try again.')
    } finally {
      setRetrying(false)
    }
  }

  const steps: Step[] = [
    { label: 'Extracting text', state: 'done' },
    { label: 'Analysing with AI', state: 'active' },
    { label: 'Compiling results', state: 'pending' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-sans text-[24px] font-medium leading-8 text-grey-900">{contract.name}</h1>
        <span className="font-sans text-[12px] text-grey-500">
          {contract.contract_type} · {contract.page_count} pages
        </span>
      </div>

      <NotLegalAdviceDisclaimer />

      {isProcessing && (
        <Card className="p-8">
          <p className="mb-4 font-sans text-[16px] font-medium text-grey-900">Analysing your contract…</p>
          <ProgressStepper steps={steps} />
        </Card>
      )}

      {isError && (
        <Card className="flex flex-col gap-3 p-8">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 text-red-700" />
            <p className="font-sans text-[16px] text-grey-900">
              Analysis failed. Your text is saved — you can retry without re-uploading.
            </p>
          </div>
          {retryError && <p className="font-sans text-[12px] text-red-700">{retryError}</p>}
          <Button onClick={retry} loading={retrying} className="self-start">
            Retry analysis
          </Button>
        </Card>
      )}

      {isComplete && (
        <>
          {/* Mobile-only 3-way switch */}
          <div className="flex gap-1 rounded-md border border-grey-100 bg-white p-1 md:hidden">
            <TabButton
              active={mobileView === 'document'}
              onClick={() => setMobileView('document')}
              icon={<FileText size={14} />}
              label="Document"
            />
            <TabButton
              active={mobileView === 'panel' && panel === 'terms'}
              onClick={() => {
                setMobileView('panel')
                setPanel('terms')
              }}
              icon={<ListChecks size={14} />}
              label="Terms"
            />
            <TabButton
              active={mobileView === 'panel' && panel === 'chat'}
              onClick={() => {
                setMobileView('panel')
                setPanel('chat')
              }}
              icon={<MessageSquare size={14} />}
              label="Chat"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Left — document viewer (always shown on md+; on mobile only in 'document' view) */}
            <Card
              className={cn(
                'h-[70vh] overflow-hidden md:block',
                mobileView === 'document' ? 'block' : 'hidden',
              )}
            >
              <DocumentViewer
                signedUrl={signedUrl}
                contractText={contract.contract_text}
                targetPage={targetPage}
              />
            </Card>

            {/* Right — panel column (always shown on md+; on mobile only in 'panel' view) */}
            <Card
              className={cn(
                'flex h-[70vh] flex-col overflow-hidden md:flex',
                mobileView === 'panel' ? 'flex' : 'hidden',
              )}
            >
              {/* Desktop-only tab switch */}
              <div className="hidden gap-1 border-b border-grey-100 p-2 md:flex">
                <TabButton
                  active={panel === 'terms'}
                  onClick={() => setPanel('terms')}
                  icon={<ListChecks size={14} />}
                  label="Key terms"
                />
                <TabButton
                  active={panel === 'chat'}
                  onClick={() => setPanel('chat')}
                  icon={<MessageSquare size={14} />}
                  label="Chat"
                />
              </div>

              {panel === 'terms' ? (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <div className="flex flex-col gap-6 p-5">
                    <KeyTermsPanel keyTerms={keyTerms} onNavigate={navigate} onTermUpdated={onTermUpdated} />
                    <div className="border-t border-grey-100 pt-5">
                      <FeedbackWidget contractId={contract.id} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="min-h-0 flex-1">
                  <ChatPanel contractId={contract.id} enabled={isComplete} onNavigate={navigate} />
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 font-sans text-[12px] font-medium transition',
        active ? 'bg-blue-50 text-brand' : 'text-grey-500 hover:text-grey-900',
      )}
    >
      {icon}
      {label}
    </button>
  )
}
