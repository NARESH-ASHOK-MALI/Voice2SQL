# Voice2SQL++ 🎙️💻

Voice2SQL++ is an intelligent Natural Language Interface designed to easily query unstructured and semi-structured data. Users can upload a variety of file formats, automatically infer relational schemas, and query that data using plain English (text or voice) without writing a single line of SQL.

## 🌟 Key Features

- **Multi-Format Data Ingestion**: Upload CSV, JSON, TXT, and even **PDF documents** (with automatic table extraction).
- **Auto-Schema Inference**: Automatically detects columns, types, and structure from your uploaded files and loads them into a fast, local SQLite database.
- **Natural Language to SQL**: Converts your plain English queries into valid SQL using state-of-the-art LLMs.
- **Multi-Provider LLM Support**: Seamlessly switch between **Google Gemini**, **NVIDIA NIM (Llama 3, Nemotron)**, and **OpenAI/Grok**.
- **Interactive Data Preview**: View the auto-inferred schema and the top 5 rows of your uploaded data in a horizontally-scrollable preview panel to verify ingestion.
- **Data Visualization**: Automatically generates beautiful tabular results and dynamic charts based on your queried data.
- **Robust Rate Limiting & Security**: Built-in token bucket algorithms prevent API spam, read-only SQL execution prevents SQL injection, and robust LLM retry logic ensures high availability.

## 🏗️ Architecture & Monorepo Structure

Voice2SQL++ is built using a modern, decoupled three-tier architecture:

- **`frontend/`** – **React 18 + Vite + Tailwind UI**: The user-facing application featuring file uploads, horizontally scrollable data previews, a query interface, and chart visualizations.
- **`backend/`** – **Node.js + Express**: The orchestration layer API that handles file passing, request routing, rate limiting, and securely proxying requests to the Python NLP service.
- **`nlp_service/`** – **Python 3.10+ FastAPI**: The core AI engine. Handles data parsing (Pandas, PDFPlumber), schema generation, transcription (Google STT/Vosk), and LLM context building (FastAPI, AsyncOpenAI, Google GenAI).

## 🚀 Quick Start

### 1. Prerequisites
Ensure you have the following installed on your machine:
- Node.js 18+
- Python 3.10+
- `npm` and `pip`

### 2. Setup Environment Variables
Initialize your environment variables by copying the example file in the root directory:
```bash
cp .env.example .env
```
*(Also ensure you check `nlp_service/.env` for Python-specific variables if separated)*

**Configure your LLM Provider (`LLM_PROVIDER`):**
- **`nvidia`** (Recommended Free Tier): Uses NVIDIA NIM. Set `NVIDIA_API_KEY` and `NVIDIA_MODEL` (e.g., `meta/llama-3.2-11b-vision-instruct`). Get your API key from [build.nvidia.com](https://build.nvidia.com).
- **`gemini`**: Uses Google Gemini via Google AI Studio. Set `GEMINI_API_KEY` and `GEMINI_MODEL` (e.g., `gemini-1.5-flash`).
- **`openai` / `grok`**: Uses standard OpenAI-compatible APIs.

### 3. Install Dependencies
Install all NPM dependencies across the monorepo and set up the Python virtual environment for the NLP service:
```bash
npm run install:all
```

### 4. Run All Services
Start the frontend, Express backend, and FastAPI NLP service concurrently:
```bash
npm run dev
```

**Services will be available at:**
- 🖥️ **Frontend UI**: http://localhost:5173
- ⚙️ **Backend API**: http://localhost:3000
- 🧠 **NLP Service**: http://localhost:8001

## 📡 API Endpoints

### Backend (`http://localhost:3000/api`)
- `POST /upload` – Accepts files (CSV, JSON, PDF, TXT) up to 10MB and proxies to the NLP `/ingest` service.
- `POST /query` – Expects JSON `{ query: string }`. Proxies to NLP `/nl2sql` to generate and execute the query.
- `GET /results` – Retrieves the results of the last successful query `{ sql: string, rows: any[] }`.
- `POST /voice` – Accepts an `audio` file and proxies to the NLP `/transcribe` service.

### NLP Service (`http://localhost:8001`)
- `POST /ingest` – Parses files into Pandas DataFrames, loads them into SQLite, and registers the schema (returning top 5 rows for UI preview).
- `POST /nl2sql` – Connects to the configured LLM to generate a strict, read-only `SELECT` statement based solely on the database schema. Validates via `EXPLAIN` and intelligently retries if the generated SQL is malformed.
- `POST /transcribe` – Converts speech-to-text using Google STT (if enabled) with a local Vosk fallback.

## 🛡️ Rate Limiting & Security
- **API Throttling**: Both Express and FastAPI endpoints feature configurable rate limiting to prevent abuse.
- **Token Bucket Retry**: Outbound calls to LLM providers are rate-limited on our side using an asynchronous token bucket to respect strict API limits (handling 429s gracefully).
- **SQL Injection Prevention**: Generated SQL queries are strictly validated. Only single `SELECT` statements are permitted, and they are executed on a read-only SQLite connection URI (`?mode=ro`).

## 🛠️ Troubleshooting
- **Missing API Keys (500 Error):** If your chosen provider's API key is missing or uses the default placeholder text, the NLP service will immediately throw an HTTP 500 error. Check your `.env` files.
- **NVIDIA Model 404 Error:** Ensure your `NVIDIA_MODEL` variable points to a valid model available to your NVIDIA NIM account (e.g., `meta/llama-3.2-11b-vision-instruct`).
- **SQLite Database Locks:** Avoid keeping `voice2sql.sqlite` open in external database viewers while uploading/ingesting new files, as this can lock the database file.
- **Hot-Reloading Env Vars:** The FastAPI service is configured with `load_dotenv(override=True)` so you don't necessarily need to restart the Python server when modifying API keys in the `.env` file during development.
