import os
import io
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import pdfplumber
import re
from sqlalchemy import create_engine, text, inspect
from dotenv import load_dotenv

from llm_client import generate_sql
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.requests import Request

# --- GLOBAL SETUP ---
load_dotenv(override=True)
DB_PATH = os.getenv('DB_PATH', 'voice2sql.sqlite')
engine = create_engine(f'sqlite:///{DB_PATH}')

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Voice2SQL++ NLP Service")

allowed_origins = os.getenv('ALLOWED_ORIGINS', 'http://localhost:5173').split(',')
app.add_middleware(CORSMiddleware, allow_origins=allowed_origins, allow_methods=["*"], allow_headers=["*"])

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

schema_store: dict = {}

class QueryBody(BaseModel):
    query: Optional[str] = None
    voice: Optional[str] = None

def register_schema(table: str):
    insp = inspect(engine)
    cols = insp.get_columns(table)
    with engine.connect() as conn:
        sample_rows = conn.execute(text(f'SELECT * FROM "{table}" LIMIT 3')).fetchall()
    schema_store[table] = {
        "columns": [
            {
                "name": c["name"],
                "type": str(c["type"]),
                "samples": [str(row[i]) for row in sample_rows]
            }
            for i, c in enumerate(cols)
        ]
    }

def build_schema_text() -> str:
    parts = []
    for tbl, info in schema_store.items():
        col_lines = []
        for c in info["columns"]:
            col_lines.append(f'  {c["name"]} ({c["type"]})')
        parts.append(f'TABLE "{tbl}":\n' + "\n".join(col_lines))
    return "\n\n".join(parts)

async def validate_and_fix(sql: str, question: str, schema: str, retries: int = 2) -> str:
    for attempt in range(retries + 1):
        # Strip and clean
        sql = sql.strip().rstrip(';')
        # Remove markdown fences if present
        sql = re.sub(r'^```sql\s*', '', sql, flags=re.IGNORECASE)
        sql = re.sub(r'\s*```$', '', sql)
        sql = sql.strip()
        
        if not sql.upper().startswith('SELECT'):
            if attempt == retries:
                raise HTTPException(400, 'Only SELECT queries allowed')
            # Ask LLM to fix
            fix_prompt = (
                f"The following is not a valid SELECT query:\n{sql}\n"
                f"Rewrite it as a single SELECT statement for this schema:\n{schema}\n"
                f"Question: {question}\nSQL:"
            )
            sql = await generate_sql(fix_prompt)
            continue
        
        if ';' in sql:
            if attempt == retries:
                raise HTTPException(400, 'Only a single SELECT allowed')
            fix_prompt = (
                f"This SQL has multiple statements:\n{sql}\n"
                "Rewrite as a single SELECT. Return ONLY the SQL.\nSQL:"
            )
            sql = await generate_sql(fix_prompt)
            continue
        
        try:
            ro_url = f'sqlite:///file:{DB_PATH}?mode=ro&uri=true'
            ro_engine = create_engine(ro_url)
            with ro_engine.connect() as conn:
                conn.execute(text(f'EXPLAIN {sql}'))
            return sql
        except Exception as e:
            if attempt == retries:
                raise HTTPException(422, f'SQL error after retries: {e}')
            fix_prompt = (
                f"This SQL failed:\n{sql}\nError: {e}\n"
                f"Schema:\n{schema}\n"
                "Fix it. Return ONLY the corrected SELECT.\nSQL:"
            )
            sql = await generate_sql(fix_prompt)
    return sql

def execute_readonly(sql: str) -> list:
    ro_url = f'sqlite:///file:{DB_PATH}?mode=ro&uri=true'
    ro_engine = create_engine(ro_url)
    with ro_engine.connect() as conn:
        result = conn.execute(text(sql))
        return [dict(row._mapping) for row in result]

@app.post('/ingest')
@limiter.limit(os.getenv('RATE_LIMIT_UPLOAD_PER_MIN', '10') + '/minute')
async def ingest(request: Request, files: List[UploadFile] = File(...)):
    tables = []
    for f in files:
        name = f.filename
        content = await f.read()
        ext = (name.split('.')[-1] or '').lower()
        df = None
        try:
            if ext == 'csv': 
                df = pd.read_csv(io.BytesIO(content))
            elif ext == 'json': 
                df = pd.read_json(io.BytesIO(content))
            elif ext == 'pdf':
                with pdfplumber.open(io.BytesIO(content)) as pdf:
                    first_table = None
                    for page in pdf.pages:
                        extracted_tables = page.extract_tables()
                        if extracted_tables:
                            first_table = extracted_tables[0]; break
                    if first_table and len(first_table) > 1:
                        headers = first_table[0]; data = first_table[1:]
                        df = pd.DataFrame(data, columns=headers); df.dropna(how='all', inplace=True)
                        for col in df.columns: df[col] = pd.to_numeric(df[col], errors='ignore')
                    else: raise ValueError("No data tables could be extracted from the PDF.")
            elif ext == 'txt':
                try:
                    df = pd.read_csv(io.BytesIO(content), sep='\t')
                    if len(df.columns) == 1:
                        text_all = content.decode(errors='ignore')
                        lines = [l.strip() for l in text_all.splitlines() if l.strip()]
                        df = pd.DataFrame({"line": lines})
                except Exception:
                    text_all = content.decode(errors='ignore')
                    lines = [l.strip() for l in text_all.splitlines() if l.strip()]
                    df = pd.DataFrame({"line": lines})
            else:
                text_all = content.decode(errors='ignore')
                lines = [l.strip() for l in text_all.splitlines() if l.strip()]
                df = pd.DataFrame({"line": lines})
            
            if df is None: raise ValueError(f"Could not process file: {name}")
            
            raw_name = os.path.splitext(name)[0]
            table_name = re.sub(r'\W+', '_', raw_name).lower().strip('_')
            
            df.to_sql(table_name, engine, if_exists='replace', index=False)
            register_schema(table_name)
            
            top_rows = df.head(5).fillna("").to_dict(orient='records')
            tables.append({
                "name": table_name,
                "columns": list(df.columns),
                "samples": top_rows
            })
        except Exception as e:
            tables.append({"name": name, "error": str(e)})
    return {"tables": tables}

@app.post('/nl2sql')
@limiter.limit(os.getenv('RATE_LIMIT_QUERY_PER_MIN', '20') + '/minute')
async def nl2sql(request: Request, body: QueryBody):
    question = body.query or body.voice or ''
    if not question:
        raise HTTPException(400, 'Empty query')
    
    schema = build_schema_text()
    if not schema:
        raise HTTPException(400, 'No data uploaded yet. Please upload a file first.')
    
    prompt = (
        "You write SQLite SQL. Use ONLY the tables and columns below.\n"
        "If the user uses a different word (e.g. teacher), map it to the closest real\n"
        "column/table. Return one SELECT statement, nothing else.\n\n"
        f"{schema}\n\n"
        f"Question: {question}\n"
        "SQL:"
    )
    
    sql = await generate_sql(prompt)
    sql = await validate_and_fix(sql, question, schema, retries=2)
    rows = execute_readonly(sql)
    return {"sql": sql, "rows": rows}

@app.post('/transcribe')
@limiter.limit(os.getenv('RATE_LIMIT_VOICE_PER_MIN', '10') + '/minute')
async def transcribe(request: Request, audio: UploadFile = File(...)):
    use_google = os.getenv('GOOGLE_STT_ENABLED', 'false').lower() == 'true'
    data = await audio.read()
    transcript: Optional[str] = None

    if use_google:
        try:
            from google.cloud import speech_v1p1beta1 as speech  # type: ignore
            client = speech.SpeechClient()
            audio_cfg = speech.RecognitionAudio(content=data)
            config = speech.RecognitionConfig(
                language_code='en-US',
                enable_automatic_punctuation=True,
                encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
            )
            response = client.recognize(config=config, audio=audio_cfg)
            transcript = ' '.join([r.alternatives[0].transcript for r in response.results])
        except Exception as e:
            return {"error": f"Google STT failed: {e}"}
    else:
        try:
            import vosk  # type: ignore
            import json as pyjson
            import wave
            import tempfile
            # Assume audio is wav/pcm16; if not, client should send wav
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
                tmp.write(data)
                tmp.flush()
                wf = wave.open(tmp.name, 'rb')
                model = vosk.Model(lang='en-us')
                rec = vosk.KaldiRecognizer(model, wf.getframerate())
                rec.SetWords(True)
                while True:
                    buf = wf.readframes(4000)
                    if len(buf) == 0:
                        break
                    rec.AcceptWaveform(buf)
                result = pyjson.loads(rec.FinalResult())
                transcript = result.get('text', '').strip()
        except Exception:
            return {"error": "No STT available. Enable GOOGLE_STT_ENABLED or install vosk."}

    return {"text": transcript or ""}
