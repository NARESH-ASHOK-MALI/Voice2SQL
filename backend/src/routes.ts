import { Router } from 'express'
import multer from 'multer'
import axios from 'axios'
import { db } from './db'
import FormData from 'form-data'

const upload = multer({ storage: multer.memoryStorage() })
const router = Router()

const PY_SERVICE_URL = process.env.PY_SERVICE_URL || 'http://localhost:8001'

router.post('/upload', upload.array('files'), async (req, res) => {
  try {
    const form = new FormData()
    for (const f of req.files as Express.Multer.File[]) {
      form.append('files', f.buffer, { filename: f.originalname, contentType: f.mimetype })
    }
    const r = await axios.post(`${PY_SERVICE_URL}/ingest`, form, { headers: form.getHeaders() })
    res.json(r.data)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/query', async (req, res) => {
  try {
    const { query, voice } = req.body || {}
    const r = await axios.post(`${PY_SERVICE_URL}/nl2sql`, { query, voice })
    const rows = r.data?.rows || []
    await db('last_results').insert({ rows: JSON.stringify(rows) })
    res.json(r.data)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/results', async (_req, res) => {
  try {
    const last = await db('last_results').orderBy('id', 'desc').first()
    const rows = last?.rows ? JSON.parse(last.rows) : []
    res.json({ rows })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/voice', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'audio file missing' })
    const form = new FormData()
    form.append('audio', req.file.buffer, { filename: req.file.originalname || 'audio.wav', contentType: req.file.mimetype || 'audio/wav' })
    const r = await axios.post(`${PY_SERVICE_URL}/transcribe`, form, { headers: form.getHeaders() })
    res.json(r.data)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

export default router

