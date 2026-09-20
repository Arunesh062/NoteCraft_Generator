# NoteCraft LLM Service

> **⚠️ OPTIONAL / LEGACY / SELF-HOSTED LINUX GPU ONLY**
>
> This directory is **NOT required** for NoteCraft production or local development.
> The core NoteCraft production backend is **CPU-only** and calls external HTTPS APIs.
>
> This service is retained strictly as legacy/reference code for developers who want to self-host vLLM on a Linux GPU machine.
> **Do NOT install or run vLLM on Windows or CPU machines.**

## Overview

Standalone LLM Inference microservice for NoteCraft AI, powered by **vLLM** and **Llama 3.2 3B**.

This service is decoupled from the main FastAPI application server. Its sole responsibility is high-throughput LLM inference, exposing an OpenAI-compatible `/v1/chat/completions` endpoint over HTTP.

## Architecture

```
FastAPI Main Backend (Port 8000)
         │
         │ HTTP POST /v1/chat/completions
         ▼
LLM Microservice (Port 8001)
         │
         │ Async Engine
         ▼
      vLLM
         │
         ▼
  Llama 3.2 3B
```

## Requirements

- **OS**: Linux only (vLLM does not support Windows or macOS)
- **GPU**: NVIDIA CUDA GPU with sufficient VRAM (A10G, T4, or better)
- **Python**: 3.11

## API Endpoints

- `GET /`: Service information and status.
- `GET /health`: Healthcheck endpoint for monitoring engine readiness.
- `POST /v1/chat/completions`: Chat completion endpoint consumed by NoteCraft's `LLMClient`.

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `8001` | Service listening port |
| `LLM_MODEL` / `MODEL_NAME` | `meta-llama/Llama-3.2-3B-Instruct` | Hugging Face model identifier |
| `TENSOR_PARALLEL_SIZE` | `1` | Number of GPUs for tensor parallelism |
| `GPU_MEMORY_UTILIZATION` | `0.90` | Fraction of GPU RAM allocated to vLLM |
| `MAX_MODEL_LEN` | `4096` | Context length window |

## Running (Linux GPU Only)

```bash
cd llm-service
pip install -r requirements.txt
python app.py
```

The service starts on `http://localhost:8001`. Set `LLM_URL=http://localhost:8001/v1/chat/completions` in `backend/.env`.
