import type { ApiError } from '@/types'

/** Error thrown by the client fetch helpers, carrying the server's envelope. */
export class ClientApiError extends Error {
  code: string
  retryable: boolean
  status: number
  constructor(message: string, code: string, retryable: boolean, status: number) {
    super(message)
    this.code = code
    this.retryable = retryable
    this.status = status
  }
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const err = (body as ApiError | null)?.error
    throw new ClientApiError(
      err?.message ?? 'Request failed. Please try again.',
      err?.code ?? 'INTERNAL',
      err?.retryable ?? false,
      res.status,
    )
  }
  return body as T
}

export async function apiGet<T>(url: string): Promise<T> {
  return parse<T>(await fetch(url, { method: 'GET', cache: 'no-store' }))
}

export async function apiPostJson<T>(url: string, body: unknown): Promise<T> {
  return parse<T>(
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function apiPatchJson<T>(url: string, body: unknown): Promise<T> {
  return parse<T>(
    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function apiPostForm<T>(url: string, form: FormData): Promise<T> {
  return parse<T>(await fetch(url, { method: 'POST', body: form }))
}

export async function apiDelete(url: string): Promise<void> {
  await parse<void>(await fetch(url, { method: 'DELETE' }))
}
