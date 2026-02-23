const BASE_URL = '/api'

export interface ReceiptSummary {
  id: string
  status: string
  original_filename: string
  vendor_name: string | null
  transaction_date: string | null
  total_amount: number | null
  uploaded_at: string
}

export interface JournalEntry {
  id?: number
  receipt_id?: string
  line_no: number
  debit_account: string
  debit_sub_account: string | null
  debit_department: string | null
  debit_partner: string | null
  debit_tax_class: string | null
  debit_invoice: string | null
  debit_amount: number
  debit_tax_amount: number
  credit_account: string
  credit_sub_account: string | null
  credit_department: string | null
  credit_partner: string | null
  credit_tax_class: string | null
  credit_invoice: string | null
  credit_amount: number
  credit_tax_amount: number
  description: string
  memo: string | null
  tag: string | null
}

export interface ReceiptDetail {
  id: string
  status: string
  original_filename: string
  file_extension: string
  uploaded_at: string
  ocr_text: string | null
  vendor_name: string | null
  transaction_date: string | null
  total_amount: number | null
  tax_amount: number | null
  description: string | null
  updated_at: string
  journal_entries: JournalEntry[]
}

export interface ExportRun {
  id: string
  created_at: string
  receipt_count: number
  filename: string
  status: string
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: {
      ...(options?.headers || {}),
    },
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  return response.json()
}

export async function uploadReceipts(files: File[]): Promise<ReceiptSummary[]> {
  const formData = new FormData()
  files.forEach(f => formData.append('files', f))
  return request<ReceiptSummary[]>('/receipts/upload', {
    method: 'POST',
    body: formData,
  })
}

export async function listReceipts(status?: string): Promise<ReceiptSummary[]> {
  const params = status ? `?status=${status}` : ''
  return request<ReceiptSummary[]>(`/receipts${params}`)
}

export async function getReceipt(id: string): Promise<ReceiptDetail> {
  return request<ReceiptDetail>(`/receipts/${id}`)
}

export function getReceiptImageUrl(id: string): string {
  return `${BASE_URL}/receipts/${id}/image`
}

export async function updateReceipt(
  id: string,
  data: Partial<ReceiptDetail> & { journal_entries?: JournalEntry[] }
): Promise<ReceiptDetail> {
  return request<ReceiptDetail>(`/receipts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export async function approveReceipt(id: string): Promise<ReceiptDetail> {
  return request<ReceiptDetail>(`/receipts/${id}/approve`, { method: 'POST' })
}

export async function rejectReceipt(id: string): Promise<ReceiptDetail> {
  return request<ReceiptDetail>(`/receipts/${id}/reject`, { method: 'POST' })
}

export async function bulkApprove(receiptIds: string[]): Promise<{ approved: string[]; errors: string[] }> {
  return request('/receipts/approve-bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ receipt_ids: receiptIds }),
  })
}

export async function runExport(): Promise<ExportRun> {
  return request<ExportRun>('/exports/run', { method: 'POST' })
}

export async function listExports(): Promise<ExportRun[]> {
  return request<ExportRun[]>('/exports')
}

export function getExportDownloadUrl(runId: string): string {
  return `${BASE_URL}/exports/${runId}/download`
}
