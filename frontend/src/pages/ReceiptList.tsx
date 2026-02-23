import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router'
import FileUpload from '../components/FileUpload'
import { listReceipts, uploadReceipts, getReceiptImageUrl, ReceiptSummary } from '../api/client'

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

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listReceipts(filter || undefined)
      setReceipts(data)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  const handleUpload = async (files: File[]) => {
    await uploadReceipts(files)
    await load()
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Receipts</h2>
      <FileUpload onUpload={handleUpload} />

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

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : receipts.length === 0 ? (
        <p className="text-gray-500">No receipts found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full bg-white rounded-lg shadow">
            <thead className="bg-gray-50 border-b">
              <tr>
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
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
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
