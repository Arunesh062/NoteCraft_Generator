import os
from dotenv import load_dotenv

# Load environment variables first
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routers import chunks, finalize, status

app = FastAPI(title="NoteCraft AI Backend (CPU Only)", version="3.0.0")

allowed_origins_raw = os.getenv("ALLOWED_ORIGINS", "*")
if not allowed_origins_raw.strip() or allowed_origins_raw.strip() == "*":
    allowed_origins = ["*"]
    allow_credentials = False
else:
    allowed_origins = [o.strip() for o in allowed_origins_raw.split(",") if o.strip()]
    allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chunks.router,   tags=["Chunks"])
app.include_router(finalize.router, tags=["Finalize"])
app.include_router(status.router,   tags=["Status"])

OUTPUTS_DIR = os.path.join(os.path.dirname(__file__), "outputs")
os.makedirs(OUTPUTS_DIR, exist_ok=True)
app.mount("/outputs", StaticFiles(directory=OUTPUTS_DIR), name="outputs")

@app.get("/")
async def root():
    return {
        "status": "NoteCraft AI Backend is running (CPU Only)",
        "stt_provider": os.getenv("STT_PROVIDER", "groq"),
        "llm_provider": os.getenv("LLM_PROVIDER", "huggingface"),
        "llm_model": os.getenv("LLM_MODEL", "meta-llama/Llama-3.1-8B-Instruct"),
    }

@app.get("/health")
async def health():
    return {
        "status": "ok"
    }

@app.get("/config-status")
async def config_status():
    stt_url = os.getenv("STT_API_URL", "")
    llm_url = os.getenv("LLM_API_URL") or os.getenv("LLM_URL", "")
    return {
        "status": "ok",
        "stt_provider": os.getenv("STT_PROVIDER", "groq"),
        "stt_configured": bool(stt_url),
        "llm_provider": os.getenv("LLM_PROVIDER", "huggingface"),
        "llm_configured": bool(llm_url),
        "llm_model": os.getenv("LLM_MODEL", "meta-llama/Llama-3.1-8B-Instruct"),
    }