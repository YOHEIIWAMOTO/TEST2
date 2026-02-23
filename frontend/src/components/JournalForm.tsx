import { useState, useEffect } from 'react'
import type { JournalEntry } from '../api/client'

interface JournalFormProps {
  entries: JournalEntry[]
  onSave: (entries: JournalEntry[]) => Promise<void>
  disabled?: boolean
}

function defaultEntry(): JournalEntry {
  return {
    line_no: 1,
    debit_account: '',
    debit_sub_account: null,
    debit_department: null,
    debit_partner: null,
    debit_tax_class: null,
    debit_invoice: null,
    debit_amount: 0,
    debit_tax_amount: 0,
    credit_account: '',
    credit_sub_account: null,
    credit_department: null,
    credit_partner: null,
    credit_tax_class: null,
    credit_invoice: null,
    credit_amount: 0,
    credit_tax_amount: 0,
    description: '',
    memo: null,
    tag: null,
  }
}

function Field({
  label,
  value,
  onChange,
  disabled,
  type = 'text',
}: {
  label: string
  value: string | number | null
  onChange: (v: string) => void
  disabled?: boolean
  type?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500 w-20 shrink-0 text-right">{label}</label>
      <input
        type={type}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="flex-1 px-2 py-1 border rounded text-sm disabled:bg-gray-100 disabled:text-gray-500"
      />
    </div>
  )
}

export default function JournalForm({ entries, onSave, disabled }: JournalFormProps) {
  const [entry, setEntry] = useState<JournalEntry>(entries[0] || defaultEntry())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (entries.length > 0) setEntry(entries[0])
  }, [entries])

  const update = (field: keyof JournalEntry, value: string | number | null) => {
    setEntry(prev => ({ ...prev, [field]: value }))
  }

  const updateStr = (field: keyof JournalEntry) => (v: string) => {
    update(field, v || null)
  }

  const updateNum = (field: keyof JournalEntry) => (v: string) => {
    update(field, v === '' ? 0 : parseInt(v, 10))
  }

  const handleSave = async () => {
    setSaving(true)
    try { await onSave([entry]) } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-3 space-y-2 bg-blue-50">
        <h4 className="text-sm font-semibold text-blue-800">Debit (borrower)</h4>
        <Field label="Account" value={entry.debit_account} onChange={v => update('debit_account', v)} disabled={disabled} />
        <Field label="Sub Acct" value={entry.debit_sub_account} onChange={updateStr('debit_sub_account')} disabled={disabled} />
        <Field label="Dept" value={entry.debit_department} onChange={updateStr('debit_department')} disabled={disabled} />
        <Field label="Partner" value={entry.debit_partner} onChange={updateStr('debit_partner')} disabled={disabled} />
        <Field label="Tax Class" value={entry.debit_tax_class} onChange={updateStr('debit_tax_class')} disabled={disabled} />
        <Field label="Invoice" value={entry.debit_invoice} onChange={updateStr('debit_invoice')} disabled={disabled} />
        <Field label="Amount" value={entry.debit_amount} onChange={updateNum('debit_amount')} disabled={disabled} type="number" />
        <Field label="Tax Amt" value={entry.debit_tax_amount} onChange={updateNum('debit_tax_amount')} disabled={disabled} type="number" />
      </div>

      <div className="border rounded-lg p-3 space-y-2 bg-green-50">
        <h4 className="text-sm font-semibold text-green-800">Credit (lender)</h4>
        <Field label="Account" value={entry.credit_account} onChange={v => update('credit_account', v)} disabled={disabled} />
        <Field label="Sub Acct" value={entry.credit_sub_account} onChange={updateStr('credit_sub_account')} disabled={disabled} />
        <Field label="Dept" value={entry.credit_department} onChange={updateStr('credit_department')} disabled={disabled} />
        <Field label="Partner" value={entry.credit_partner} onChange={updateStr('credit_partner')} disabled={disabled} />
        <Field label="Tax Class" value={entry.credit_tax_class} onChange={updateStr('credit_tax_class')} disabled={disabled} />
        <Field label="Invoice" value={entry.credit_invoice} onChange={updateStr('credit_invoice')} disabled={disabled} />
        <Field label="Amount" value={entry.credit_amount} onChange={updateNum('credit_amount')} disabled={disabled} type="number" />
        <Field label="Tax Amt" value={entry.credit_tax_amount} onChange={updateNum('credit_tax_amount')} disabled={disabled} type="number" />
      </div>

      <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
        <h4 className="text-sm font-semibold text-gray-700">Details</h4>
        <Field label="Desc" value={entry.description} onChange={v => update('description', v)} disabled={disabled} />
        <Field label="Memo" value={entry.memo} onChange={updateStr('memo')} disabled={disabled} />
        <Field label="Tag" value={entry.tag} onChange={updateStr('tag')} disabled={disabled} />
      </div>

      {!disabled && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
        >
          {saving ? 'Saving...' : 'Save Journal Entry'}
        </button>
      )}
    </div>
  )
}
