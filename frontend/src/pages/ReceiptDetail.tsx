import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import ImageViewer from '../components/ImageViewer'
import JournalForm from '../components/JournalForm'
import {
  getReceipt, getReceiptImageUrl, updateReceipt, approveReceipt, rejectReceipt,
  ReceiptDetail, JournalEntry,
} from '../api/client'

export default function ReceiptDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savingFields, setSavingFields] = useState(false)

  // Editable field state
  const [vendorName, setVendorName] = useState('')
  const [txDate, setTxDate] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [taxAmount, setTaxAmount] = useState('')
  const [desc, setDesc] = useState('')

  useEffect(() => {
    if (id) {
      getReceipt(id).then(r => {
        setReceipt(r)
        setVendorName(r.vendor_name || '')
        setTxDate(r.transaction_date || '')
        setTotalAmount(r.total_amount != null ? String(r.total_amount) : '')
        setTaxAmount(r.tax_amount != null ? String(r.tax_amount) : '')
        setDesc(r.description || '')
      }).catch(e => setError(e.message))
    }
  }, [id])

  const handleSaveFields = async () => {
    if (!id) return
    setSavingFields(true)
    try {
      const updated = await updateReceipt(id, {
        vendor_name: vendorName || null,
        transaction_date: txDate || null,
        total_amount: totalAmount ? parseInt(totalAmount, 10) : null,
        tax_amount: taxAmount ? parseInt(taxAmount, 10) : null,
        description: desc || null,
      })
      setReceipt(updated)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingFields(false)
    }
  }

  const handleSaveJournal = async (entries: JournalEntry[]) => {
    if (!id) return
    const updated = await updateReceipt(id, { journal_entries: entries })
    setReceipt(updated)
  }

  const handleApprove = async () => {
    if (!id) return
    try {
      const updated = await approveReceipt(id)
      setReceipt(updated)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Approve failed')
    }
  }

  const handleReject = async () => {
    if (!id) return
    try {
      const updated = await rejectReceipt(id)
      setReceipt(updated)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Reject failed')
    }
  }

  if (error) return <div className="text-red-600 p-4">{error}</div>
  if (!receipt) return <div className="text-gray-500 p-4">Loading...</div>

  const isApproved = receipt.status === 'approved'
  const isRejected = receipt.status === 'rejected'
  const isLocked = isApproved

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{receipt.original_filename}</h2>
          <p className="text-sm text-gray-500 font-mono">{receipt.id}</p>
          <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-medium ${
            isApproved ? 'bg-green-100 text-green-700' :
            isRejected ? 'bg-red-100 text-red-700' :
            'bg-yellow-100 text-yellow-700'
          }`}>{receipt.status}</span>
        </div>
        <div className="flex gap-2">
          {!isApproved && !isRejected && (
            <>
              <button
                onClick={handleApprove}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
              >Approve</button>
              <button
                onClick={handleReject}
                className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm font-medium"
              >Reject</button>
            </>
          )}
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm font-medium"
          >Back</button>
        </div>
      </div>

      {/* Split layout: image (sticky) + form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left: Image viewer - sticky so it stays visible while scrolling the form */}
        <div className="lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]">
          <ImageViewer src={getReceiptImageUrl(receipt.id)} alt={receipt.original_filename} />
        </div>

        {/* Right: Extracted data + Journal form */}
        <div className="space-y-6">
          {/* Extracted receipt fields */}
          <div className="bg-white rounded-lg shadow p-4 space-y-3">
            <h3 className="font-semibold text-lg text-gray-900">Receipt Data</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 w-24 shrink-0">Vendor</label>
                <input
                  type="text"
                  value={vendorName}
                  onChange={e => setVendorName(e.target.value)}
                  disabled={isLocked}
                  className="flex-1 px-3 py-1.5 border rounded text-sm disabled:bg-gray-100"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 w-24 shrink-0">Date</label>
                <input
                  type="date"
                  value={txDate}
                  onChange={e => setTxDate(e.target.value)}
                  disabled={isLocked}
                  className="flex-1 px-3 py-1.5 border rounded text-sm disabled:bg-gray-100"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 w-24 shrink-0">Amount</label>
                <input
                  type="number"
                  value={totalAmount}
                  onChange={e => setTotalAmount(e.target.value)}
                  disabled={isLocked}
                  className="flex-1 px-3 py-1.5 border rounded text-sm disabled:bg-gray-100"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 w-24 shrink-0">Tax</label>
                <input
                  type="number"
                  value={taxAmount}
                  onChange={e => setTaxAmount(e.target.value)}
                  disabled={isLocked}
                  className="flex-1 px-3 py-1.5 border rounded text-sm disabled:bg-gray-100"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 w-24 shrink-0">Description</label>
                <input
                  type="text"
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  disabled={isLocked}
                  className="flex-1 px-3 py-1.5 border rounded text-sm disabled:bg-gray-100"
                />
              </div>
            </div>
            {!isLocked && (
              <button
                onClick={handleSaveFields}
                disabled={savingFields}
                className="w-full py-2 bg-gray-800 text-white rounded hover:bg-gray-900 disabled:opacity-50 text-sm font-medium"
              >
                {savingFields ? 'Saving...' : 'Save Receipt Data'}
              </button>
            )}
          </div>

          {/* Journal entry form */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-lg text-gray-900 mb-4">Journal Entry</h3>
            <JournalForm
              entries={receipt.journal_entries}
              onSave={handleSaveJournal}
              disabled={isLocked}
            />
          </div>

          {/* OCR text (collapsible) */}
          {receipt.ocr_text && (
            <details className="bg-white rounded-lg shadow p-4">
              <summary className="font-semibold cursor-pointer text-gray-700">OCR Text</summary>
              <pre className="mt-2 text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded">
                {receipt.ocr_text}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  )
}
