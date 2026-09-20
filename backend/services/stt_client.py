import os
import json
import httpx
import tempfile
import subprocess
from dotenv import load_dotenv

load_dotenv()

# Provider configuration
STT_PROVIDER = os.getenv("STT_PROVIDER", "groq").lower()

# Default endpoints based on provider
DEFAULT_ENDPOINTS = {
    "groq": "https://api.groq.com/openai/v1/audio/transcriptions",
    "deepgram": "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true",
    "openai": "https://api.openai.com/v1/audio/transcriptions",
}

STT_API_URL = os.getenv("STT_API_URL", "").strip() or DEFAULT_ENDPOINTS.get(STT_PROVIDER, "")
STT_API_KEY = (os.getenv("STT_API_KEY") or os.getenv("GROQ_API_KEY") or os.getenv("DEEPGRAM_API_KEY") or "").strip()
STT_MODEL   = os.getenv("STT_MODEL", "whisper-large-v3-turbo").strip()
STT_TIMEOUT = float(os.getenv("STT_TIMEOUT", "120.0"))


async def transcribe_chunk(audio_bytes: bytes, chunk_index: int) -> dict:
    """
    Sends an audio chunk to an external HTTP STT API (Groq, Deepgram, OpenAI-compatible).
    Returns normalized transcription result with verified word-level timestamps:
        {
            "transcript": str,
            "words": [{"word": str, "start": float, "end": float}],
            "status": "ok" | "failed"
        }
    """
    if len(audio_bytes) < 1000:
        print(f"STT chunk {chunk_index}: audio too small ({len(audio_bytes)} bytes), skipping")
        return _failed_result()

    if not STT_API_KEY:
        print(f"STT chunk {chunk_index} Error: STT_API_KEY is not configured in environment")
        return _failed_result()

    if not STT_API_URL:
        print(f"STT chunk {chunk_index} Error: STT_API_URL is not configured in environment")
        return _failed_result()

    print(f"STT chunk {chunk_index}: sending {len(audio_bytes)} bytes to STT API ({STT_PROVIDER})...")

    try:
        # Convert audio to WAV or prepare for upload
        wav_bytes = _convert_to_wav(audio_bytes, chunk_index)
        upload_bytes = wav_bytes if wav_bytes else audio_bytes
        file_ext = ".wav" if wav_bytes else ".webm"
        mime_type = "audio/wav" if wav_bytes else "audio/webm"

        async with httpx.AsyncClient(timeout=STT_TIMEOUT) as client:
            if STT_PROVIDER == "deepgram":
                headers = {
                    "Authorization": f"Token {STT_API_KEY}",
                    "Content-Type": mime_type,
                }
                response = await client.post(
                    STT_API_URL,
                    headers=headers,
                    content=upload_bytes
                )
            else:
                # Default OpenAI / Groq multipart format
                headers = {
                    "Authorization": f"Bearer {STT_API_KEY}"
                }
                files = {
                    "file": (f"chunk_{chunk_index}{file_ext}", upload_bytes, mime_type)
                }
                data = {
                    "model": STT_MODEL or "whisper-large-v3-turbo",
                    "response_format": "verbose_json",
                    "timestamp_granularities[]": "word"
                }
                response = await client.post(
                    STT_API_URL,
                    headers=headers,
                    data=data,
                    files=files
                )

        if response.status_code != 200:
            print(f"STT API Error (status {response.status_code}): {response.text[:300]}")
            return _failed_result()

        res_json = response.json()
        return _normalize_stt_response(res_json, chunk_index)

    except httpx.TimeoutException:
        print(f"STT chunk {chunk_index} Error: API request timed out after {STT_TIMEOUT}s")
        return _failed_result()
    except Exception as e:
        print(f"STT chunk {chunk_index} Unexpected Error: {e}")
        return _failed_result()


def _normalize_stt_response(res: dict | list | str, chunk_index: int) -> dict:
    """
    Normalizes external STT API output (Groq, Deepgram, OpenAI) to internal NoteCraft format.
    Guarantees extraction of transcript and word-level timestamps (start, end in seconds).
    """
    if isinstance(res, str):
        print(f"STT chunk {chunk_index} Warning: Plain text string returned without word timestamps.")
        return _failed_result()

    if isinstance(res, list) and len(res) > 0:
        res = res[0]

    if not isinstance(res, dict):
        return _failed_result()

    raw_text = ""
    all_words = []

    # 1. Deepgram response structure: res["results"]["channels"][0]["alternatives"][0]
    if "results" in res and isinstance(res["results"], dict):
        channels = res["results"].get("channels", [])
        if channels and isinstance(channels, list) and len(channels) > 0:
            alts = channels[0].get("alternatives", [])
            if alts and isinstance(alts, list) and len(alts) > 0:
                alt = alts[0]
                raw_text = alt.get("transcript", "")
                words_data = alt.get("words", [])
                for w in words_data:
                    if isinstance(w, dict) and "word" in w and "start" in w and "end" in w:
                        all_words.append({
                            "word": str(w["word"]).strip(),
                            "start": round(float(w["start"]), 3),
                            "end": round(float(w["end"]), 3),
                        })

    # 2. Groq / OpenAI verbose_json structure: res["words"]
    if not raw_text:
        raw_text = res.get("text") or res.get("transcript") or ""

    if not all_words and "words" in res and isinstance(res["words"], list):
        for w in res["words"]:
            if isinstance(w, dict) and "word" in w and "start" in w and "end" in w:
                all_words.append({
                    "word": str(w["word"]).strip(),
                    "start": round(float(w["start"]), 3),
                    "end": round(float(w["end"]), 3),
                })

    # 3. Segments with nested words structure (e.g. OpenAI/Whisper segments)
    if not all_words and "segments" in res and isinstance(res["segments"], list):
        for seg in res["segments"]:
            if isinstance(seg, dict) and "words" in seg and isinstance(seg["words"], list):
                for w in seg["words"]:
                    if isinstance(w, dict) and "word" in w and "start" in w and "end" in w:
                        all_words.append({
                            "word": str(w["word"]).strip(),
                            "start": round(float(w["start"]), 3),
                            "end": round(float(w["end"]), 3),
                        })

    combined_text = raw_text.strip()
    if not combined_text:
        print(f"STT chunk {chunk_index}: Empty transcription text returned")
        return _failed_result()

    if not all_words:
        print(f"STT chunk {chunk_index} Error: STT API returned text but NO word-level timestamps! Speaker mapping requires word timestamps.")
        return _failed_result()

    print(f"STT chunk {chunk_index}: {len(combined_text)} chars, {len(all_words)} word timestamps extracted via {STT_PROVIDER}")
    return {
        "transcript": combined_text,
        "words": all_words,
        "status": "ok"
    }


def _convert_to_wav(audio_bytes: bytes, chunk_index: int) -> bytes | None:
    """
    Converts audio bytes to 16kHz mono WAV using ffmpeg if available.
    """
    tmp_in = tmp_out = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
            f.write(audio_bytes)
            tmp_in = f.name

        tmp_out = tmp_in.replace(".webm", ".wav")

        result = subprocess.run(
            ["ffmpeg", "-y", "-i", tmp_in, "-ar", "16000", "-ac", "1", "-f", "wav", tmp_out],
            capture_output=True, timeout=60,
        )

        if result.returncode != 0:
            print(f"ffmpeg conversion notice chunk {chunk_index} (will fallback to raw bytes)")
            return None

        with open(tmp_out, "rb") as f:
            return f.read()

    except Exception as e:
        print(f"WAV conversion notice chunk {chunk_index}: {e}")
        return None
    finally:
        for p in [tmp_in, tmp_out]:
            try:
                if p and os.path.exists(p):
                    os.unlink(p)
            except Exception:
                pass


def _failed_result() -> dict:
    return {"transcript": "", "words": [], "status": "failed"}

