---
title: NoteCraft AI Backend (CPU)
emoji: 🎙️
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# 🎙️ NoteCraft AI Backend — Hugging Face Space (CPU Only)

Production deployment of the **NoteCraft AI FastAPI Backend** on Hugging Face Docker Spaces running on ordinary CPU hardware.

## Architecture

```
Chrome Extension (MV3)
       ↓ HTTPS
┌─────────────────────────────────────────┐
│  THIS SPACE (CPU FastAPI Backend)       │
│                                         │
│  FastAPI + Uvicorn                      │
│  FFmpeg audio preprocessing             │
│  Speaker mapping & MAP-REDUCE pipeline  │
│  DOCX document generation               │
└──────────────┬──────────────────┬───────┘
               │ HTTPS            │ HTTPS
               ▼                  ▼
           STT API            LLM API
       (External Whisper)  (Llama 3.2 3B)
```

## Required Environment Variables & Secrets

Configure these in your Hugging Face Space Settings under **Variables and secrets**:

| Variable | Type | Description |
| :--- | :--- | :--- |
| `STT_PROVIDER` | Variable | STT Provider (e.g. `huggingface`, `groq`, `openai`) |
| `STT_API_URL` | Variable | STT API Endpoint URL |
| `STT_API_KEY` | **Secret** | API Key / Token for STT Provider |
| `STT_MODEL` | Variable | e.g. `openai/whisper-large-v3-turbo` |
| `LLM_PROVIDER` | Variable | LLM Provider (e.g. `huggingface`, `groq`, `openai`) |
| `LLM_API_URL` | Variable | Chat Completions API Endpoint URL |
| `LLM_API_KEY` | **Secret** | API Key / Token for LLM Provider |
| `LLM_MODEL` | Variable | `meta-llama/Llama-3.2-3B-Instruct` |
| `LLM_TIMEOUT` | Variable | `300` |
| `ALLOWED_ORIGINS` | Variable | `chrome-extension://<EXTENSION_ID>` or `*` |

## Hardware Recommendation

- **CPU Space**: Standard CPU hardware (e.g., Hugging Face Free/Basic CPU Space).
- No GPU or CUDA hardware is required for this backend.

## What This Container Does NOT Include

- **Local GPU Inference**: Zero local CUDA/torch/vLLM/faster-whisper dependencies.
- **Local Model Weights**: No model weights are downloaded or loaded inside this container.

The backend communicates with external AI services strictly over HTTPS APIs.
