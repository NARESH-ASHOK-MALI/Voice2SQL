# Voice2SQL++

Natural Language Interface for Querying Unstructured and Semi-Structured Data.

## Overview
Voice2SQL++ lets users upload files (PDF, CSV, JSON, TXT), automatically infers a database schema, and allows querying the data using natural language (text or voice). The system converts NL → SQL using an LLM (Gemini, Grok, or OpenAI) and returns tabular and chart visualizations.

## Monorepo Structure
- `frontend` – React 18 + Vite + Tailwind UI (upload, query, results with charts)
- `backend` – Node.js + Express API (file uploads, query orchestration, rate limiting, DB access)
- `nlp_service` – Python FastAPI (ingestion, schema inference, schema-aware NL→SQL generation, transcription)

## Quick Start

### 1. Prerequisites
- Node.js 18+
- Python 3.10+

### 2. Setup Environment Variables
Copy the `.env.example` file to `.env` in the root directory:
```bash
cp .env.example .env
```
Open `.env` and fill in your desired LLM provider credentials.

**Provider Options (`LLM_PROVIDER`):**
- `gemini`: Uses Google's free tier via an OpenAI-compatible endpoint. Get an API key from Google AI Studio (aistudio.google.com). Set `GEMINI_API_KEY` and `GEMINI_MODEL` (e.g., `gemini-1.5-flash`). Verify current free-tier availability before relying on it heavily.
- `grok`: Uses xAI's API. Get an API key from console.x.ai. Set `GROK_API_KEY` and `GROK_MODEL` (e.g., `grok-beta`).
- `openai`: Uses standard OpenAI API. Set `OPENAI_API_KEY` and `OPENAI_MODEL` (e.g., `gpt-4o-mini`).

### 3. Install Dependencies
```bash
npm run install:all
```

### 4. Run All Services
```bash
npm run dev
```

Services:
- Frontend: http://localhost:5173
- Backend (Express): http://localhost:3000
- NLP Service (FastAPI): http://localhost:8001

## API Endpoints

**Backend** (`http://localhost:3000/api`):
- `POST /upload` – Accepts files (CSV, JSON, PDF, TXT up to 10MB). Proxies to NLP `/ingest`.
- `POST /query` – JSON `{ query: string }`. Proxies to NLP `/nl2sql` and stores result.
- `GET /results` – Returns last query `{ sql: string, rows: any[] }`.
- `POST /voice` – Accepts `audio` file. Proxies to NLP `/transcribe`.

**NLP Service** (`http://localhost:8001`):
- `POST /ingest` – Parses files into DataFrames, loads them into SQLite, and registers schema.
- `POST /nl2sql` – Uses LLM to generate a single read-only `SELECT` statement based on the schema, executes it, and returns results. Validates via `EXPLAIN` and retries if SQL is malformed.
- `POST /transcribe` – Google STT if enabled, otherwise Vosk fallback (requires PCM16 WAV).

## Rate Limiting & Security
- Both Express and FastAPI endpoints have rate limiting enabled (configured via `.env`).
- LLM calls use a token-bucket outbound throttle to respect provider API limits and automatically back off on 429 errors.
- Generated SQL queries are strictly validated (single `SELECT` only, no semicolons) and executed via a read-only SQLite connection to prevent injection attacks.

## Troubleshooting
- **Missing API Keys:** If your chosen provider's API key is missing or uses the placeholder text, the NLP service will return an explicit 500 error.
- **SQLite Locks:** Avoid opening `voice2sql.sqlite` in another program (like a DB viewer) while ingesting data, as it may lock the database.
- **Backend Build:** If `npm run dev` fails to run TypeScript directly for the backend, you can manually build it: `cd backend && npm run build && npm start`.
