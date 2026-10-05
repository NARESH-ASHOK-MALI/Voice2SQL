import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import routes from './routes'
import { ensureSchema } from './db'

dotenv.config()

import rateLimit from 'express-rate-limit'

const app = express()
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',')
app.use(cors({ origin: allowedOrigins }))
app.use(express.json({ limit: '10mb' }))

// General API limiter
const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests', retryAfterSeconds: 60 }
})
app.use('/api', apiLimiter)
app.use('/api', routes)

const port = Number(process.env.PORT || 3000)

ensureSchema().then(() => {
  app.listen(port, () => console.log(`Backend listening on http://localhost:${port}`))
})

