import { Router } from 'express'
import multer from 'multer'
import axios from 'axios'
import { db } from './db'
import FormData from 'form-data'

import rateLimit from 'express-rate-limit'

const ALLOWED_EXTENSIONS = ['.csv', '.json', '.pdf', '.txt']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = '.' + (file.originalname.split('.').pop() || '').toLowerCase()
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`))
    }
  }
})
const router = Router()

const uploadLimiter = rateLimit({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_UPLOAD_PER_MIN || 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Upload rate limit exceeded', retryAfterSeconds: 60 }
})

const queryLimiter = rateLimit({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_QUERY_PER_MIN || 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Query rate limit exceeded', retryAfterSeconds: 60 }
})

const voiceLimiter = rateLimit({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_VOICE_PER_MIN || 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Voice rate limit exceeded', retryAfterSeconds: 60 }
})

const PY_SERVICE_URL = process.env.PY_SERVICE_URL || 'http://localhost:8001'

router.post('/upload', uploadLimiter, upload.array('files'), async (req, res) => {
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

router.post('/query', queryLimiter, async (req, res) => {
  try {
    const { query, voice } = req.body || {}
    const r = await axios.post(`${PY_SERVICE_URL}/nl2sql`, { query, voice })
    const sql = r.data?.sql || ''
    const rows = r.data?.rows || []
    await db('last_results').insert({ sql, rows: JSON.stringify(rows) })
    res.json(r.data)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/results', async (_req, res) => {
  try {
    const last = await db('last_results').orderBy('id', 'desc').first()
    const rows = last?.rows ? JSON.parse(last.rows) : []
    res.json({ sql: last?.sql || '', rows })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/voice', voiceLimiter, upload.single('audio'), async (req, res) => {
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

