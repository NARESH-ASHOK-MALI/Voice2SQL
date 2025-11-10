import { useState } from 'react'
import axios from 'axios'

export default function Upload() {
  const [files, setFiles] = useState<FileList | null>(null)
  const [status, setStatus] = useState<string>('')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!files || files.length === 0) return
    const formData = new FormData()
    Array.from(files).forEach(file => formData.append('files', file))
    try {
      setStatus('Uploading...')
      const res = await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setStatus(`Uploaded. Inferred ${res.data?.tables?.length ?? 0} tables.`)
    } catch (err: any) {
      setStatus('Upload failed')
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
    </div>
  )
}

