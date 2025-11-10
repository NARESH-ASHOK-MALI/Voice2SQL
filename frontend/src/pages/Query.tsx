import { useEffect, useRef, useState } from 'react'
import axios from 'axios'

export default function Query() {
  const [query, setQuery] = useState('')
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => {
    const SpeechRecognitionImpl = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    if (SpeechRecognitionImpl) {
      const recog: SpeechRecognition = new SpeechRecognitionImpl()
      recog.lang = 'en-US'
      recog.interimResults = false
      recog.continuous = false
      recog.onresult = (e: SpeechRecognitionEvent) => {
        const text = e.results[0][0].transcript
        setQuery(text)
        setListening(false)
      }
      recog.onend = () => setListening(false)
      recognitionRef.current = recog
    }
  }, [])

  const toggleMic = async () => {
    const recog = recognitionRef.current
    // Prefer Web Speech when available
    if (recog) {
      if (listening) {
        recog.stop()
        setListening(false)
      } else {
        setListening(true)
        recog.start()
      }
      return
    }
    // Fallback: capture audio and send to backend for STT
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const chunks: BlobPart[] = []
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data)
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/wav' })
        const form = new FormData()
        form.append('audio', blob, 'query.wav')
        const r = await axios.post('/api/voice', form)
        const text = r.data?.text || ''
        if (text) setQuery(text)
      }
      mediaRecorder.start()
      setListening(true)
      setTimeout(() => {
        mediaRecorder.stop()
        setListening(false)
        stream.getTracks().forEach(t => t.stop())
      }, 4000)
    } catch {
      // no-op
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await axios.post('/api/query', { query })
    console.log(res.data)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Query</h2>
      <form onSubmit={onSubmit} className="flex gap-2">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g., Show total sales by month" className="flex-1 border rounded px-3 py-2" />
        <button type="button" onClick={toggleMic} className={`px-3 py-2 rounded ${listening ? 'bg-red-600' : 'bg-gray-700'} text-white`}>{listening ? 'Stop' : 'Mic'}</button>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Run</button>
      </form>
      <p className="text-gray-600 text-sm">Voice recognition uses the browser Web Speech API when available.</p>
    </div>
  )
}

