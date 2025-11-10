import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import routes from './routes'
import { ensureSchema } from './db'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use('/api', routes)

const port = Number(process.env.PORT || 3000)

ensureSchema().then(() => {
  app.listen(port, () => console.log(`Backend listening on http://localhost:${port}`))
})

