import { useState, useEffect, useCallback } from 'react'
import ReceiptCard from '../components/ReceiptCard'
import {
  listReceipts, getReceipt, approveReceipt, rejectReceipt, bulkApprove,
  ReceiptSummary, ReceiptDetail,
} from '../api/client'

export default function ReviewQueue() {
  const [summaries, setSummaries] = useState<ReceiptSummary[]>([])
  const [details, setDetails] = useState<Map<string, ReceiptDetail>>(new Map())
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listReceipts('needs_review')
      setSummaries(data)
      // Fetch full details for each receipt (needed for journal entries)
      const detailMap = new Map<string, ReceiptDetail>()
      const fetched = await Promise.all(data.map(r => getReceipt(r.id)))
      for (const d of fetched) {
        detailMap.set(d.id, d)
      }
      setDetails(detailMap)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleApprove = async (id: string) => {
    setApproving(true)
    try {
      await approveReceipt(id)
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Approve failed')
    } finally {
      setApproving(false)
    }
  }

  const handleReject = async (id: string) => {
    setApproving(true)
    try {
      await rejectReceipt(id)
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Reject failed')
    } finally {
      setApproving(false)
    }
  }

  const handleApproveAll = async () => {
    if (summaries.length === 0) return
    setApproving(true)
    setError(null)
    try {
      const result = await bulkApprove(summaries.map(r => r.id))
      if (result.errors.length > 0) {
        setError(`Some receipts failed: ${result.errors.join(', ')}`)
      }
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Bulk approve failed')
    } finally {
      setApproving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Review Queue</h2>
          <p className="text-sm text-gray-500">
            {summaries.length} receipt{summaries.length !== 1 ? 's' : ''} pending review
          </p>
        </div>
        {summaries.length > 0 && (
          <button
            onClick={handleApproveAll}
            disabled={approving}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
          >
            {approving ? 'Processing...' : `Approve All (${summaries.length})`}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : summaries.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No receipts pending review.
        </div>
      ) : (
        <div className="space-y-4">
          {summaries.map(s => {
            const detail = details.get(s.id)
            if (!detail) return null
            return (
              <ReceiptCard
                key={s.id}
                receipt={detail}
                onApprove={handleApprove}
                onReject={handleReject}
                approving={approving}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
