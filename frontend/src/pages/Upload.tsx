import { useState } from 'react'
import axios from 'axios'

export default function Upload() {
  const [files, setFiles] = useState<FileList | null>(null)
  const [status, setStatus] = useState<string>('')
  const [tablesData, setTablesData] = useState<any[]>([])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!files || files.length === 0) return
    const formData = new FormData()
    Array.from(files).forEach(file => formData.append('files', file))
    try {
      setStatus('Uploading...')
      setTablesData([])
      const res = await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setStatus(`Uploaded. Inferred ${res.data?.tables?.length ?? 0} tables.`)
      if (res.data?.tables) {
        setTablesData(res.data.tables)
      }
    } catch (err: any) {
      setStatus('Upload failed')
      setTablesData([])
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Upload Data</h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <input type="file" multiple accept=".pdf,.csv,.json,.txt" onChange={e => setFiles(e.target.files)} className="block" placeholder="Upload files" />
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Upload</button>
      </form>
      {status && <p className="text-gray-700">{status}</p>}
      
      {tablesData.map((table, i) => (
        <div key={i} className="mt-4 border border-gray-200 rounded p-4 shadow-sm bg-white">
          <h3 className="text-lg font-bold text-gray-800">Table: {table.name}</h3>
          {table.error ? (
            <p className="text-red-500 mt-2">Error processing file: {table.error}</p>
          ) : (
            <div className="mt-3">
              <p className="text-sm text-gray-500 mb-2">Preview (Top {table.samples?.length || 0} rows)</p>
              <div className="overflow-x-auto rounded border border-gray-200">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      {table.columns?.map((col: string) => (
                        <th key={col} className="px-4 py-2 font-medium border-b border-gray-200 whitespace-nowrap">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.samples?.map((row: any, idx: number) => (
                      <tr key={idx} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                        {table.columns?.map((col: string) => (
                          <td key={col} className="px-4 py-2 whitespace-nowrap">{String(row[col])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
