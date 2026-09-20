# ============================================================
# NoteCraft AI — Hugging Face Docker Space (CPU Only)
# ============================================================
# Production container for the CPU-only FastAPI backend.
# Both STT and LLM inference run on external HTTPS APIs.
#
# Build context: repository root (../)
#   docker build -f hf-backend/Dockerfile -t notecraft-backend .
# ============================================================

FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# ── System dependencies ─────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Python dependencies ─────────────────────────────────────
COPY hf-backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# ── Application source code ─────────────────────────────────
COPY backend /app/backend
COPY hf-backend /app/hf-backend

ENV PYTHONPATH=/app/backend:/app/hf-backend:/app

# ── Default environment (overridden by HF Space Variables) ──
ENV PORT=7860
ENV STT_PROVIDER=huggingface
ENV LLM_PROVIDER=huggingface
ENV LLM_MODEL=meta-llama/Llama-3.2-3B-Instruct

# ── Expose Hugging Face Space standard port ──────────────────
EXPOSE 7860

# ── Launch ───────────────────────────────────────────────────
CMD ["python", "/app/hf-backend/app.py"]
