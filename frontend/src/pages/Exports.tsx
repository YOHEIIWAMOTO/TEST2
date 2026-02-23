import { useState, useEffect } from 'react'
import {
  listExports, runExport, getExportDownloadUrl,
  ExportRun,
} from '../api/client'

export default function Exports() {
  const [exports, setExports] = useState<ExportRun[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    const data = await listExports()
    setExports(data)
  }

  useEffect(() => { load() }, [])

  const handleExport = async () => {
    setLoading(true)
    setError(null)
    try {
      await runExport()
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-gray-900">CSV Exports</h2>
        <button
          onClick={handleExport}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
        >
          {loading ? 'Exporting...' : 'Export Approved Receipts'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {exports.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No exports yet. Approve some receipts and click "Export Approved Receipts".
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full bg-white rounded-lg shadow">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Run ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Receipts</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {exports.map(exp => (
                <tr key={exp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono text-gray-900">{exp.id}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {new Date(exp.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">{exp.receipt_count}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      exp.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>{exp.status}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <a
                      href={getExportDownloadUrl(exp.id)}
                      className="text-blue-600 hover:underline text-sm"
                      download
                    >
                      Download CSV
                    </a>
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
