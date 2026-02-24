import { useState, useEffect, useMemo } from 'react'
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
  error,
  required,
}: {
  label: string
  value: string | number | null
  onChange: (v: string) => void
  disabled?: boolean
  type?: string
  error?: string
  required?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500 w-20 shrink-0 text-right">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="flex-1">
        <input
          type={type}
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          className={`w-full px-2 py-1 border rounded text-sm disabled:bg-gray-100 disabled:text-gray-500 ${
            error ? 'border-red-400 bg-red-50' : ''
          }`}
        />
        {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
      </div>
    </div>
  )
}

interface ValidationErrors {
  debit_account?: string
  credit_account?: string
  debit_amount?: string
  credit_amount?: string
  description?: string
  balance?: string
}

function validate(entry: JournalEntry): ValidationErrors {
  const errors: ValidationErrors = {}
  if (!entry.debit_account.trim()) errors.debit_account = 'Required'
  if (!entry.credit_account.trim()) errors.credit_account = 'Required'
  if (entry.debit_amount < 0) errors.debit_amount = 'Cannot be negative'
  if (entry.credit_amount < 0) errors.credit_amount = 'Cannot be negative'
  if (entry.debit_amount === 0 && entry.credit_amount === 0) {
    errors.debit_amount = 'Amount required'
    errors.credit_amount = 'Amount required'
  }
  if (entry.debit_amount !== entry.credit_amount) {
    errors.balance = 'Debit and credit amounts must match'
  }
  if (!entry.description.trim()) errors.description = 'Required'
  return errors
}

export default function JournalForm({ entries, onSave, disabled }: JournalFormProps) {
  const [entry, setEntry] = useState<JournalEntry>(entries[0] || defaultEntry())
  const [saving, setSaving] = useState(false)
  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => {
    if (entries.length > 0) setEntry(entries[0])
  }, [entries])

  const errors = useMemo(() => validate(entry), [entry])
  const hasErrors = Object.keys(errors).length > 0

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
    setShowErrors(true)
    if (hasErrors) return
    setSaving(true)
    try { await onSave([entry]) } finally { setSaving(false) }
  }

  const fieldError = (key: keyof ValidationErrors) => showErrors ? errors[key] : undefined

  return (
    <div className="space-y-4">
      {showErrors && errors.balance && (
        <div className="bg-red-50 border border-red-200 rounded p-2 text-red-700 text-xs">
          {errors.balance}
        </div>
      )}

      <div className="border rounded-lg p-3 space-y-2 bg-blue-50">
        <h4 className="text-sm font-semibold text-blue-800">Debit (borrower)</h4>
        <Field label="Account" value={entry.debit_account} onChange={v => update('debit_account', v)} disabled={disabled} required error={fieldError('debit_account')} />
        <Field label="Sub Acct" value={entry.debit_sub_account} onChange={updateStr('debit_sub_account')} disabled={disabled} />
        <Field label="Dept" value={entry.debit_department} onChange={updateStr('debit_department')} disabled={disabled} />
        <Field label="Partner" value={entry.debit_partner} onChange={updateStr('debit_partner')} disabled={disabled} />
        <Field label="Tax Class" value={entry.debit_tax_class} onChange={updateStr('debit_tax_class')} disabled={disabled} />
        <Field label="Invoice" value={entry.debit_invoice} onChange={updateStr('debit_invoice')} disabled={disabled} />
        <Field label="Amount" value={entry.debit_amount} onChange={updateNum('debit_amount')} disabled={disabled} type="number" required error={fieldError('debit_amount')} />
        <Field label="Tax Amt" value={entry.debit_tax_amount} onChange={updateNum('debit_tax_amount')} disabled={disabled} type="number" />
      </div>

      <div className="border rounded-lg p-3 space-y-2 bg-green-50">
        <h4 className="text-sm font-semibold text-green-800">Credit (lender)</h4>
        <Field label="Account" value={entry.credit_account} onChange={v => update('credit_account', v)} disabled={disabled} required error={fieldError('credit_account')} />
        <Field label="Sub Acct" value={entry.credit_sub_account} onChange={updateStr('credit_sub_account')} disabled={disabled} />
        <Field label="Dept" value={entry.credit_department} onChange={updateStr('credit_department')} disabled={disabled} />
        <Field label="Partner" value={entry.credit_partner} onChange={updateStr('credit_partner')} disabled={disabled} />
        <Field label="Tax Class" value={entry.credit_tax_class} onChange={updateStr('credit_tax_class')} disabled={disabled} />
        <Field label="Invoice" value={entry.credit_invoice} onChange={updateStr('credit_invoice')} disabled={disabled} />
        <Field label="Amount" value={entry.credit_amount} onChange={updateNum('credit_amount')} disabled={disabled} type="number" required error={fieldError('credit_amount')} />
        <Field label="Tax Amt" value={entry.credit_tax_amount} onChange={updateNum('credit_tax_amount')} disabled={disabled} type="number" />
      </div>

      <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
        <h4 className="text-sm font-semibold text-gray-700">Details</h4>
        <Field label="Desc" value={entry.description} onChange={v => update('description', v)} disabled={disabled} required error={fieldError('description')} />
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
