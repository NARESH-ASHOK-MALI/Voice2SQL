Voice2SQL++: Natural Language Interface for Querying Unstructured and Semi-Structured Data

## Overview
Voice2SQL++ lets users upload files (PDF, CSV, JSON, TXT), automatically infer a database schema, and query the data using natural language (text or voice). The system converts NL → SQL and returns tabular and chart visualizations.

## Monorepo Structure
- `frontend` – React + Vite + Tailwind UI (upload, query, results with charts)
- `backend` – Node.js + Express API (file uploads, query orchestration, DB access)
- `nlp_service` – Python FastAPI (ingestion, schema inference, NL→SQL)

## Quick Start

1) Prerequisites
- Node.js 18+
- Python 3.10+
- SQLite (default) or MySQL

2) Install Dependencies
```bash
npm run install:all
```

3) One-time model setup (recommended)
```bash
python -m spacy download en_core_web_sm
```

4) Run All Services (Dev)
```bash
npm run dev
```

Services:
- Frontend: http://localhost:5173
- Backend (Express): http://localhost:3000
- NLP Service (FastAPI): http://localhost:8001

If backend dev fails to run TypeScript directly, build and start it:
```bash
cd backend && npm run build && npm start
```

## Environment Variables

Create `.env` files in `backend` and `nlp_service` as needed.

Backend `.env` example:
```
PORT=3000
DB_CLIENT=sqlite3
DB_URL=./voice2sql.sqlite
PY_SERVICE_URL=http://localhost:8001
GOOGLE_STT_ENABLED=false
GOOGLE_APPLICATION_CREDENTIALS=./gcp.json
```

Python service `.env` example:
```
# SQLAlchemy URL (SQLite default):
DB_URL=sqlite:///./voice2sql.sqlite
# OpenAI API key for LangChain SQL Agent (recommended):
OPENAI_API_KEY=your_openai_api_key_here
```

## API Endpoints

Backend (prefix http://localhost:3000/api):
- POST /upload – multipart `files[]`; proxies to NLP `/ingest`
- POST /query – JSON `{ query?: string, voice?: string }`; proxies to NLP `/nl2sql` and stores last result
- GET /results – returns last query rows `{ rows: any[] }`
- POST /voice – multipart `audio` (wav/pcm16 recommended); proxies to NLP `/transcribe`

NLP Service (prefix http://localhost:8001):
- POST /ingest – accepts multiple files; creates/updates SQLite tables and simple schema registry
- POST /nl2sql – naive NL→SQL via transformers pipeline fallback; executes SQL and returns rows
- POST /transcribe – Google STT if enabled, otherwise Vosk if available

## Deployment
- Frontend → Vercel (build with `npm run build` inside `frontend`)
- Backend + NLP Service → Render/Heroku/Fly.io (set env vars; allow backend to reach NLP service)

## Troubleshooting
- spaCy model: If you see errors or degraded NLP, run `python -m spacy download en_core_web_sm`.
- LangChain dependencies: If you get dependency conflicts during `pip install -r nlp_service/requirements.txt`, the versions have been updated to resolve conflicts. Try again.
- OpenAI API: Set `OPENAI_API_KEY` environment variable for the best Text-to-SQL experience. Without it, the system falls back to simple pattern matching.
- SQLite locks: Avoid opening `voice2sql.sqlite` in another program while writing.
- Windows Python: Ensure `python` and `pip` refer to the same interpreter; `py -m pip install -r nlp_service/requirements.txt` can help.
- Backend TypeScript dev: If `nodemon src/server.ts` fails, build and run JS (`npm run build && npm start`) or configure ts-node preload.

## Notes
- Voice input uses the Web Speech API in the browser by default. Backend hooks for Google STT or Vosk are scaffolded.
- The NL→SQL model is a placeholder pipeline; plug in a fine-tuned T5/BART or LangChain for production.

