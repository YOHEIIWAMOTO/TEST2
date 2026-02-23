import { Link } from 'react-router'
import { getReceiptImageUrl, type ReceiptDetail } from '../api/client'

interface ReceiptCardProps {
  receipt: ReceiptDetail
  onApprove: (id: string) => void
  onReject: (id: string) => void
  approving?: boolean
}

export default function ReceiptCard({ receipt, onApprove, onReject, approving }: ReceiptCardProps) {
  const entry = receipt.journal_entries[0]
  const isApproved = receipt.status === 'approved'
  const isRejected = receipt.status === 'rejected'

  return (
    <div className={`bg-white rounded-lg shadow border-2 transition-colors ${
      isApproved ? 'border-green-400' : isRejected ? 'border-red-300' : 'border-transparent'
    }`}>
      <div className="flex flex-col sm:flex-row gap-4 p-4">
        {/* Receipt image thumbnail */}
        <Link to={`/receipts/${receipt.id}`} className="shrink-0">
          <div className="w-full sm:w-48 h-64 bg-gray-100 rounded-lg overflow-hidden">
            <img
              src={getReceiptImageUrl(receipt.id)}
              alt={receipt.original_filename}
              className="w-full h-full object-contain"
            />
          </div>
        </Link>

        {/* Receipt + journal summary */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium text-gray-900">{receipt.vendor_name || 'Unknown vendor'}</p>
              <p className="text-xs text-gray-500 font-mono">{receipt.id}</p>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-medium shrink-0 ${
              isApproved ? 'bg-green-100 text-green-700' :
              isRejected ? 'bg-red-100 text-red-700' :
              'bg-yellow-100 text-yellow-700'
            }`}>
              {receipt.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div>
              <span className="text-gray-500">Date:</span>{' '}
              <span className="text-gray-900">{receipt.transaction_date || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500">Amount:</span>{' '}
              <span className="text-gray-900 font-medium">
                {receipt.total_amount != null ? `\u00a5${receipt.total_amount.toLocaleString()}` : '-'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Tax:</span>{' '}
              <span className="text-gray-900">
                {receipt.tax_amount != null ? `\u00a5${receipt.tax_amount.toLocaleString()}` : '-'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">File:</span>{' '}
              <span className="text-gray-900 truncate">{receipt.original_filename}</span>
            </div>
          </div>

          {entry && (
            <div className="bg-gray-50 rounded p-2 text-sm space-y-1">
              <div className="flex gap-4">
                <div>
                  <span className="text-blue-600 font-medium">Debit:</span> {entry.debit_account}
                  {entry.debit_tax_class && <span className="text-gray-400 text-xs ml-1">({entry.debit_tax_class})</span>}
                </div>
                <div className="text-gray-400">-&gt;</div>
                <div>
                  <span className="text-green-600 font-medium">Credit:</span> {entry.credit_account}
                </div>
              </div>
              <p className="text-gray-600 text-xs truncate">{entry.description}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <Link
              to={`/receipts/${receipt.id}`}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
            >
              Edit
            </Link>
            {!isApproved && !isRejected && (
              <>
                <button
                  onClick={() => onApprove(receipt.id)}
                  disabled={approving}
                  className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => onReject(receipt.id)}
                  disabled={approving}
                  className="px-3 py-1.5 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 disabled:opacity-50"
                >
                  Reject
                </button>
              </>
            )}
            {isApproved && (
              <span className="px-3 py-1.5 text-green-700 text-sm font-medium">Approved</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
