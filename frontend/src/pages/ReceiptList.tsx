import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router'
import FileUpload from '../components/FileUpload'
import {
  listReceipts, uploadReceipts, getReceiptImageUrl,
  bulkApprove, bulkDelete,
  ReceiptSummary,
} from '../api/client'

const STATUS_FILTERS = ['uploaded', 'ocr_done', 'extracted', 'needs_review', 'approved', 'rejected']
const STATUS_COLORS: Record<string, string> = {
  uploaded: 'bg-gray-100 text-gray-700',
  ocr_done: 'bg-blue-100 text-blue-700',
  extracted: 'bg-purple-100 text-purple-700',
  needs_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export default function ReceiptList() {
  const [receipts, setReceipts] = useState<ReceiptSummary[]>([])
  const [filter, setFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [acting, setActing] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listReceipts(filter || undefined)
      setReceipts(data)
      setSelected(new Set())
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  const handleUpload = async (files: File[]) => {
    await uploadReceipts(files)
    await load()
  }

  // -- Selection helpers --
  const allSelected = receipts.length > 0 && selected.size === receipts.length
  const someSelected = selected.size > 0

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(receipts.map(r => r.id)))
    }
  }

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4000)
  }

  // -- Bulk actions --
  const handleBulkApprove = async () => {
    if (!someSelected) return
    setActing(true)
    try {
      const result = await bulkApprove([...selected])
      if (result.errors.length > 0) {
        showMsg(`Approved ${result.approved.length}, errors: ${result.errors.length}`, 'error')
      } else {
        showMsg(`${result.approved.length} receipts approved`, 'success')
      }
      await load()
    } catch (e: unknown) {
      showMsg(e instanceof Error ? e.message : 'Approve failed', 'error')
    } finally {
      setActing(false)
    }
  }

  const handleBulkDelete = async () => {
    if (!someSelected) return
    if (!window.confirm(`Delete ${selected.size} receipt(s)?`)) return
    setActing(true)
    try {
      const result = await bulkDelete([...selected])
      if (result.errors.length > 0) {
        showMsg(`Deleted ${result.deleted.length}, errors: ${result.errors.length}`, 'error')
      } else {
        showMsg(`${result.deleted.length} receipts deleted`, 'success')
      }
      await load()
    } catch (e: unknown) {
      showMsg(e instanceof Error ? e.message : 'Delete failed', 'error')
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Receipts</h2>
      <FileUpload onUpload={handleUpload} />

      {/* Status filters */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter('')}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            !filter ? 'bg-gray-800 text-white' : 'bg-gray-200 hover:bg-gray-300'
          }`}
        >All</button>
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              filter === s ? 'bg-gray-800 text-white' : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >{s}</button>
        ))}
      </div>

      {/* Notification */}
      {message && (
        <div className={`rounded-lg p-3 text-sm ${
          message.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <span className="text-sm text-blue-800 font-medium">{selected.size} selected</span>
          <button
            onClick={handleBulkApprove}
            disabled={acting}
            className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
          >Approve</button>
          <button
            onClick={handleBulkDelete}
            disabled={acting}
            className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
          >Delete</button>
          <button
            onClick={() => setSelected(new Set())}
            className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 ml-auto"
          >Clear</button>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : receipts.length === 0 ? (
        <p className="text-gray-500">No receipts found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full bg-white rounded-lg shadow">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-center w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Image</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">File</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {receipts.map(r => (
                <tr
                  key={r.id}
                  className={`transition-colors ${
                    selected.has(r.id) ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleOne(r.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/receipts/${r.id}`}>
                      <img
                        src={getReceiptImageUrl(r.id)}
                        alt=""
                        className="w-10 h-10 object-cover rounded border"
                      />
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/receipts/${r.id}`} className="text-blue-600 hover:underline text-sm font-mono">
                      {r.id.slice(0, 10)}...
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{r.original_filename}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{r.vendor_name || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{r.transaction_date || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    {r.total_amount != null ? `\u00a5${r.total_amount.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] || ''}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
