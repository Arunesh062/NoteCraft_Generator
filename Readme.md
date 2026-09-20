---
title: NoteCraft AI Backend
emoji: 🎙️
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

<p align="center">
  <img src="https://img.shields.io/badge/version-3.0.0-blueviolet.svg?style=for-the-badge" alt="Version" />
  <img src="https://img.shields.io/badge/Backend-CPU%20Only-brightgreen?style=for-the-badge" alt="CPU Only" />
  <img src="https://img.shields.io/badge/FastAPI-v0.110+-009688?style=for-the-badge&logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/STT%20API-External%20HTTPS-orange?style=for-the-badge" alt="STT API" />
  <img src="https://img.shields.io/badge/LLM%20API-Llama%203.2%203B-blue?style=for-the-badge" alt="LLM API" />
  <img src="https://img.shields.io/badge/Chrome-MV3-4285F4?style=for-the-badge&logo=googlechrome" alt="Chrome MV3" />
</p>

# 🎙️ NoteCraft AI

### *Intelligence-Driven Minutes of Meeting (MoM) & Online Session Notes Generator*

**NoteCraft AI** is a professional-grade Chrome extension + CPU-only FastAPI backend system that automatically captures live audio from virtual meetings (Google Meet, Zoom, MS Teams), transcribes it via an external Speech-to-Text (STT) HTTPS API, and synthesizes structured **Minutes of Meeting (MoM)** or **Online Session Notes** using an external LLM HTTPS API (Llama 3.2 3B).

---

## 🏗️ Final Architecture (CPU Only)

```
Chrome Extension (Manifest V3 + React 18)
        ↓ HTTPS
CPU-only FastAPI Backend (Uvicorn)
        │
        ├── Audio chunk ingestion (30s WebM chunks)
        ├── Speaker mapping (DOM diarization)
        ├── MAP-REDUCE summarization pipeline
        ├── Meeting / Online Session classification
        ├── Final LLM refinement pass
        └── DOCX generation (python-docx)
        │
        ├──→ External STT API (HTTPS)
        │       ↓
        │    Whisper (Remote Inference)
        │       ↓
        │    Normalized Transcript & Timestamps
        │
        └──→ External LLM API (HTTPS)
                ↓
        Llama 3.2 3B / Compatible LLM (Remote Inference)
                ↓
          Meeting Notes / MoM DOCX
```

### Why We Moved Away from Local GPUs

1. **Lightweight Deployment**: The FastAPI backend no longer requires local NVIDIA GPUs, CUDA drivers, cuDNN libraries, `torch`, `ctranslate2`, `faster-whisper`, or local `vLLM`.
2. **Universal Hosting**: The backend runs seamlessly on standard CPU servers, Hugging Face CPU Docker Spaces, or local development machines (`python run.py`).
3. **Managed AI Inference**: All heavy speech recognition and language model computation are delegated to external, scalable HTTPS APIs.

---

## ✨ Key Features

### 🎨 Premium Floating Widget UI
- **Draggable FAB (Floating Action Button)** overlaying active meeting tabs.
- **Ref-based dragging** bypassing React state-update cycles for 60FPS fluid movement.
- **Viewport Guardians** preventing widget loss off-screen.
- **Chrome MV3 Compliant** with background service workers and offscreen audio loopback capture.

### 🎧 Audio Capture & Processing Pipeline
- **Unified Audio Loopback**: Simultaneously captures tab audio (remote speakers) and microphone into a single stream.
- **30-second Async Chunking**: Audio is split into 30s segments and processed concurrently.
- **External STT Client**: Sends audio chunks to an external HTTP API (Hugging Face Inference API / Groq / OpenAI), retrieving transcripts and word/segment timestamps.
- **DOM Speaker Diarization**: Scrapes live speaker indicators from meeting tab DOM and correlates word-level timestamps to real speakers.
- **MAP-REDUCE Aggregation**: Groups every 5 chunk summaries into block summaries before final document synthesis.
- **Automatic Classification**: Classifies content as standard business meeting (`mom`) or educational class (`online_session`).
- **Refinement Pass**: Final LLM pass improves formatting, tone, and JSON schema compliance.
- **DOCX Generation**: Formats notes into professional Word documents with styled tables.

---

## 🛠️ Tech Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Frontend** | React 18 + Vite | Chrome Extension (MV3) with Shadow DOM isolation |
| **Backend** | FastAPI + Uvicorn | Python 3.11 ASGI server (CPU Only) |
| **STT Client** | `backend/services/stt_client.py` | Async HTTP client calling external STT HTTPS API |
| **LLM Client** | `backend/services/llm_client.py` | Async HTTP client calling external OpenAI-compatible Chat Completions HTTPS API |
| **Audio Converter** | FFmpeg | WebM → WAV signal conversion (optional signal normalization) |
| **Document Export** | python-docx | Styled DOCX document builder |

---

## 📂 Project Structure

```
NoteCraft-Generator/
├── extension-react/                 # Chrome Extension (React + Vite)
│   ├── config.js                    # Configurable BACKEND_URL (http://localhost:8000 or Production)
│   ├── public/manifest.json         # Manifest V3 configuration
│   ├── src/                         # React UI & Floating widget
│   ├── content.jsx                  # DOM scraping & speaker timeline tracking
│   ├── background.js                # Chunk upload worker
│   ├── offscreen.js                 # Audio loopback capture
│   └── ready.html                   # Status & download page
│
├── backend/                         # CPU-only FastAPI Backend Application
│   ├── main.py                      # FastAPI app factory, CORS, static outputs, endpoints
│   ├── run.py                       # Local dev launcher (port 8000)
│   ├── models.py                    # Pydantic data schemas
│   ├── requirements.txt             # Backend Python dependencies (CPU-only)
│   ├── .env.example                 # Environment configuration template
│   ├── routers/
│   │   ├── chunks.py                # POST /upload-chunk
│   │   ├── finalize.py              # POST /finalize (MAP-REDUCE pipeline)
│   │   └── status.py                # GET /status, GET /download, GET /outputs
│   ├── services/
│   │   ├── stt_client.py            # External STT HTTP client (replacing local faster-whisper)
│   │   ├── llm_client.py            # External LLM HTTP client (provider-agnostic)
│   │   ├── whisper_stt.py           # Compatibility bridge to stt_client
│   │   ├── speaker_map.py           # Speaker timeline mapper
│   │   ├── export.py                # DOCX exporter
│   │   └── metrics_logger.py        # Metrics evaluator
│   └── session/
│       └── store.py                 # In-memory session store
│
├── hf-backend/                      # Hugging Face Docker Space Files (CPU)
│   ├── Dockerfile                   # CPU Docker container (Python 3.11 + FFmpeg)
│   ├── app.py                       # Uvicorn entry point for HF Space (port 7860)
│   ├── requirements.txt             # CPU dependencies
│   └── README.md                    # Space metadata
│
├── llm-service/                     # [LEGACY / REFERENCE] Self-Hosted vLLM Service (Linux GPU only)
├── modal/                           # [LEGACY / REFERENCE] Modal Deployment Scripts
├── Dockerfile                       # Root CPU Dockerfile
├── .gitignore
└── Readme.md
```

---

## 💻 Local Development

### Prerequisites

- **Python**: 3.11+
- **Node.js**: 18+
- **FFmpeg**: Installed and available in PATH
- **No GPU, CUDA, vLLM, or local Whisper required!**

### 1️⃣ Configure Environment Variables

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` with your external API credentials:
```env
# Application
ALLOWED_ORIGINS=http://localhost:3000,*

# STT API (External HTTPS Speech-to-Text API)
STT_PROVIDER=huggingface
STT_API_URL=https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3-turbo
STT_API_KEY=hf_xxxxxxxxxxxxxxxxxxxxxxxxx
STT_MODEL=openai/whisper-large-v3-turbo
STT_TIMEOUT=120

# LLM API (External HTTPS Chat Completions API)
LLM_PROVIDER=huggingface
LLM_API_URL=https://router.huggingface.co/hf-inference/v1/chat/completions
LLM_API_KEY=hf_xxxxxxxxxxxxxxxxxxxxxxxxx
LLM_MODEL=meta-llama/Llama-3.2-3B-Instruct
LLM_TIMEOUT=300
```

### 2️⃣ Run CPU Backend

```bash
cd backend
pip install -r requirements.txt
python run.py
```

Verify backend health:
```bash
curl http://localhost:8000/health
# Output: {"status":"ok"}

curl http://localhost:8000/config-status
```

### 3️⃣ Build & Load Chrome Extension

```bash
cd extension-react
npm install
npm run build
```

Open Chrome → `chrome://extensions` → Enable **Developer Mode** → Click **Load Unpacked** → Select `extension-react/dist`.

---

## 🐳 Docker Deployment

Build and run the CPU backend locally via Docker:

```bash
# Build Docker image
docker build -t notecraft-backend .

# Run Docker container
docker run -d -p 7860:7860 \
  --env-file backend/.env \
  --name notecraft-app notecraft-backend
```

Verify:
```bash
curl http://localhost:7860/health
```

---

## 🚀 Hugging Face CPU Deployment

Follow this step-by-step guide to deploy the NoteCraft-Generator backend to a Hugging Face CPU Docker Space:

1. **Create a new Hugging Face Space**: Go to [Hugging Face Spaces](https://huggingface.co/spaces) and click **Create new Space**.
2. **Choose Docker**: Select **Docker** as the Space SDK (Blank / Dockerfile).
3. **Select CPU Hardware**: Choose **CPU basic** (free-compatible) hardware.
4. **Push Deployment Files**: Clone the Space repository and push your NoteCraft code or connect your GitHub repository.
5. **Open Space Settings**: In your Space dashboard, navigate to **Settings** → **Variables and secrets**.
6. **Add Secrets and Variables**:
   Add secrets:
   - `STT_API_KEY`: Your Groq API Key (`gsk_...`)
   - `LLM_API_KEY`: Your Hugging Face API Token (`hf_...`)
   Add optional variables:
   - `STT_PROVIDER`: `groq`
   - `STT_API_URL`: `https://api.groq.com/openai/v1/audio/transcriptions`
   - `STT_MODEL`: `whisper-large-v3-turbo`
   - `LLM_PROVIDER`: `huggingface`
   - `LLM_API_URL`: `https://router.huggingface.co/v1/chat/completions`
   - `LLM_MODEL`: `meta-llama/Llama-3.1-8B-Instruct`
   - `ALLOWED_ORIGINS`: `*` (or your Chrome extension ID)
7. **Restart/Rebuild the Space**: Save settings and trigger a build. Wait until Space status becomes **Running**.
8. **Open Health Endpoint**: Access `https://<YOUR_HF_SPACE_URL>/health` in your browser.
9. **Confirm Health Status**: Verify the response is:
   ```json
   {"status":"ok"}
   ```
10. **Update Chrome Extension BACKEND_URL**: In `extension-react/config.js`, set:
    ```javascript
    export const BACKEND_URL = "https://<username>-<space-name>.hf.space";
    ```
11. **Build Extension**: Run `npm run build` in `extension-react/`.
12. **Reload Extension**: Open `chrome://extensions` in Chrome, enable **Developer Mode**, and click **Reload** on NoteCraft AI.
13. **Test Google Meet**: Open a Google Meet call (`https://meet.google.com/...`).
14. **Record Short Meeting**: Click **Start Recording** on the NoteCraft floating widget and record spoken audio for 30–60 seconds.
15. **Stop Recording**: Click **Stop & Generate Notes**.
16. **Verify `/finalize`**: Extension sends session metadata and triggers background processing.
17. **Verify `/status`**: Extension polls backend until status transitions to `"ready"`.
18. **Download DOCX**: Click **Download DOCX** on the status page to inspect the generated report.

---

> [!IMPORTANT]
> **Production Deployment Notes & Constraints:**
> - **Sleeping Spaces**: Free CPU Spaces on Hugging Face may enter sleep mode when inactive. The initial request after sleeping will wake the Space and may take slightly longer.
> - **Ephemeral Storage**: In-memory sessions and locally stored DOCX files in `/app/backend/outputs` are not permanent across Space restarts or rebuilds.
> - **API Quotas & Limits**: External Groq and Hugging Face API rate limits and token usage quotas apply.
> - **Server-Side Key Security**: API keys (`STT_API_KEY`, `LLM_API_KEY`) remain strictly on the backend server/Space secrets and are NEVER sent to or visible inside the Chrome extension.
> - **Shared Capacity**: Multiple NoteCraft users accessing the backend share the provider capacity and API keys configured on the backend server.


---

## 🚀 Render Free Backend Deployment

Follow this step-by-step guide to deploy the NoteCraft-Generator backend to Render using the Free Web Service tier:

1. **Create/login to Render**: Go to [Render](https://render.com) and log in or create an account.
2. **Create a new Web Service**: Click **New +** → **Web Service** (or Blueprints).
3. **Connect the GitHub repository**: Grant Render access to your GitHub account.
4. **Select the NoteCraft repository**: Choose `NoteCraft-Generator`.
5. **Configure the service to use the backend application**: Set the Name to `notecraft-backend`, Environment to `Python 3`, and Region.
6. **Set the build command**:
   ```bash
   pip install -r backend/requirements.txt
   ```
7. **Set the start command**:
   ```bash
   cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
8. **Select the Free plan**: Choose the **Free** instance type.
9. **Add environment variables**:
   Add the following Environment Variables in the Render Dashboard:
   - `STT_PROVIDER`: `groq`
   - `STT_API_URL`: `https://api.groq.com/openai/v1/audio/transcriptions`
   - `STT_MODEL`: `whisper-large-v3-turbo`
   - `STT_TIMEOUT`: `120`
   - `LLM_PROVIDER`: `huggingface`
   - `LLM_API_URL`: `https://router.huggingface.co/v1/chat/completions`
   - `LLM_MODEL`: `meta-llama/Llama-3.1-8B-Instruct`
   - `LLM_TIMEOUT`: `300`
   - `ALLOWED_ORIGINS`: `*`
10. **Add STT_API_KEY as a secret**: Set `STT_API_KEY` to your Groq API Key (`gsk_...`).
11. **Add LLM_API_KEY as a secret**: Set `LLM_API_KEY` to your Hugging Face Token (`hf_...`).
12. **Deploy**: Click **Create Web Service**.
13. **Wait for the service to become Live**: Render will build the service and update the status to **Live**.
14. **Open Health Endpoint**: Access `https://YOUR-SERVICE.onrender.com/health` in your browser.
15. **Confirm Health Status**: Verify response:
    ```json
    {"status":"ok"}
    ```
16. **Update extension-react/config.js with the real Render URL**: Set:
    ```javascript
    export const BACKEND_URL = "https://YOUR-SERVICE.onrender.com";
    ```
17. **Run npm run build**: Run `npm run build` inside `extension-react/`.
18. **Reload the extension in chrome://extensions**: Enable Developer Mode and click Reload.
19. **Open Google Meet**: Navigate to a Google Meet session.
20. **Test a short recording**: Click **Start Recording** on the NoteCraft floating widget and record spoken audio for 30–60 seconds.
21. **Verify upload**: Confirm chunk uploads complete.
22. **Verify finalize**: Click **Stop & Generate Notes**.
23. **Verify status becomes ready**: Extension polls `/status` until completed.
24. **Download DOCX**: Click **Download DOCX** on the status page.

---

> [!IMPORTANT]
> **Render Free Tier Limitations:**
> - **Spin Down / Inactivity Sleep**: Free Render Web Services automatically spin down after 15 minutes of inactivity. The first incoming request after sleep will wake the service and may take 30–50 seconds.
> - **Resource Constraints**: Free Web Services have limited CPU and RAM (512 MB).
> - **Ephemeral Filesystem**: Render Free filesystems are non-persistent. Local files stored in `/app/backend/outputs` and in-memory session states are cleared whenever the service restarts, spins down, or redeploys.
> - **Concurrency Limits**: Free CPU instances are optimized for lightweight single-session/MVP usage.
> - **External API Limits**: Groq and Hugging Face API rate limits and token quotas apply independently of Render's platform constraints.


## 🛡️ Secret Management & Security

- **Environment-Variable Secrets**: `STT_API_KEY` and `LLM_API_KEY` are read exclusively from environment variables or platform secrets.
- **Zero Log Leaks**: Secrets are never output to logs, `/health`, `/config-status`, or client responses.
- **Fast Healthchecks**: `GET /health` returns `{"status": "ok"}` instantly without triggering external API calls.

---

## ⚠️ API Pricing, Quotas & Error Handling

- **External Provider Limits**: External STT and LLM providers may enforce free tier quotas, rate limits (HTTP 429), or require paid API credits. NoteCraft does not claim any third-party API is permanently free.
- **Robust Error Recovery**:
  - HTTP 401 / 403 / 429 / 500 responses and connection timeouts are caught gracefully.
  - Individual chunk STT failures mark the chunk as failed while allowing the meeting pipeline to proceed.
  - LLM JSON generation includes automatic retries and structural fallback templates if parsing fails.

---

## 🏛️ Legacy & Reference Code

- **`modal/`**: Contains legacy Modal Cloud serverless GPU scripts for reference. Not required for production.
- **`llm-service/`**: Contains legacy self-hosted vLLM inference server for Linux GPU machines. Not required for production.
