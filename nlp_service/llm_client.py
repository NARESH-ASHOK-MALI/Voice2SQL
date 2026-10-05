import os
import re
import asyncio
import time
from dotenv import load_dotenv
from fastapi import HTTPException
from google import genai
from google.genai import types as genai_types
from google.genai.errors import APIError as GenaiAPIError
from openai import AsyncOpenAI
import openai
load_dotenv(override=True)

# --- Rate Limiting Logic ---
LLM_MAX_RPM = int(os.getenv("LLM_MAX_RPM", "10"))
LLM_MAX_RETRIES = int(os.getenv("LLM_MAX_RETRIES", "3"))

class TokenBucket:
    def __init__(self, capacity: int, fill_rate: float):
        self.capacity = capacity
        self.fill_rate = fill_rate  # tokens per second
        self.tokens = float(capacity)
        self.last_fill = time.monotonic()
        self.lock = asyncio.Lock()

    async def consume(self, tokens: int = 1) -> bool:
        async with self.lock:
            now = time.monotonic()
            elapsed = now - self.last_fill
            self.tokens = min(float(self.capacity), self.tokens + elapsed * self.fill_rate)
            self.last_fill = now
            if self.tokens >= tokens:
                self.tokens -= tokens
                return True
            return False

    async def wait_and_consume(self, tokens: int = 1):
        while True:
            if await self.consume(tokens):
                return
            await asyncio.sleep(0.5)

# fill rate is LLM_MAX_RPM per minute -> LLM_MAX_RPM / 60.0 tokens per second
limiter = TokenBucket(capacity=LLM_MAX_RPM, fill_rate=LLM_MAX_RPM / 60.0)

async def _call_gemini_with_retry(client: genai.Client, model: str, prompt: str) -> str:
    import random
    for attempt in range(LLM_MAX_RETRIES + 1):
        await limiter.wait_and_consume(1)
        try:
            response = await client.aio.models.generate_content(
                model=model,
                contents=prompt,
                config=genai_types.GenerateContentConfig(temperature=0.0)
            )
            return response.text or ""
        except GenaiAPIError as e:
            if e.code in [400, 401, 403, 404]:
                print(f"Gemini Client Error (Fatal): {e}")
                raise HTTPException(status_code=400, detail=f"LLM Error: {e.message}")
            
            print(f"Gemini Client Retryable Error (Attempt {attempt+1}): {e}")
            if attempt == LLM_MAX_RETRIES:
                raise HTTPException(status_code=503, detail=f"AI service is busy or failing, try again later. Error: {e.message}")
            
            delay = 2 ** attempt + random.uniform(0, 1)
            await asyncio.sleep(delay)
        except Exception as e:
            print(f"Unexpected Gemini Error: {e}")
            raise HTTPException(status_code=500, detail=f"Unexpected AI service error: {str(e)}")
    
    raise HTTPException(status_code=503, detail="AI service error")

async def _call_openai_compat_with_retry(client: AsyncOpenAI, model: str, prompt: str) -> str:
    import random
    for attempt in range(LLM_MAX_RETRIES + 1):
        await limiter.wait_and_consume(1)
        try:
            response = await client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0
            )
            return response.choices[0].message.content or ""
        except (openai.AuthenticationError, openai.BadRequestError, openai.NotFoundError) as e:
            print(f"OpenAI Compat Error (Fatal): {e}")
            raise HTTPException(status_code=400, detail=f"LLM Error: {e}")
        except (openai.RateLimitError, openai.APIConnectionError, openai.InternalServerError) as e:
            print(f"OpenAI Compat Retryable Error (Attempt {attempt+1}): {e}")
            if attempt == LLM_MAX_RETRIES:
                raise HTTPException(status_code=429 if isinstance(e, openai.RateLimitError) else 503, 
                                    detail=f"AI service is busy or failing, try again later. Error: {e}")
            delay = 2 ** attempt + random.uniform(0, 1)
            await asyncio.sleep(delay)
        except Exception as e:
            print(f"Unexpected OpenAI Compat Error: {e}")
            raise HTTPException(status_code=500, detail=f"Unexpected AI service error: {str(e)}")
    
    raise HTTPException(status_code=503, detail="AI service error")

async def generate_sql(prompt: str) -> str:
    provider = os.getenv("LLM_PROVIDER", "gemini").lower()
    
    if provider == "gemini":
        api_key = os.getenv("GEMINI_API_KEY")
        model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
        if not api_key or "your_" in api_key:
            raise HTTPException(status_code=500, detail="Missing or invalid GEMINI_API_KEY")
        client = genai.Client(api_key=api_key)
        response_text = await _call_gemini_with_retry(client, model, prompt)
        
    elif provider == "nvidia":
        api_key = os.getenv("NVIDIA_API_KEY")
        model = os.getenv("NVIDIA_MODEL")
        base_url = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
        if not api_key or "your_" in api_key:
            raise HTTPException(status_code=500, detail="Missing or invalid NVIDIA_API_KEY")
        if not model or "your_" in model:
            raise HTTPException(status_code=500, detail="Missing or invalid NVIDIA_MODEL")
        client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        response_text = await _call_openai_compat_with_retry(client, model, prompt)
        
    else:
        raise HTTPException(status_code=500, detail=f"Unsupported LLM_PROVIDER: {provider}")

    # Strip markdown code fences from response (```sql ... ```)
    response_text = re.sub(r'^```[sS][qQ][lL]\s*', '', response_text.strip())
    response_text = re.sub(r'\s*```$', '', response_text)
    
    return response_text.strip()
