import os
import json
import httpx
import tempfile
import subprocess
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv

from services.retry import execute_with_retry, STTError, ProviderError

load_dotenv()

# Provider configuration
STT_PROVIDER = os.getenv("STT_PROVIDER", "groq").lower()

DEFAULT_ENDPOINTS = {
    "groq": "https://api.groq.com/openai/v1/audio/transcriptions",
    "deepgram": "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true",
    "openai": "https://api.openai.com/v1/audio/transcriptions",
}

STT_API_URL = os.getenv("STT_API_URL", "").strip() or DEFAULT_ENDPOINTS.get(STT_PROVIDER, "")
STT_API_KEY = (os.getenv("STT_API_KEY") or os.getenv("GROQ_API_KEY") or os.getenv("DEEPGRAM_API_KEY") or "").strip()
STT_MODEL   = os.getenv("STT_MODEL", "whisper-large-v3-turbo").strip()
STT_TIMEOUT = float(os.getenv("STT_TIMEOUT", "120.0"))


def validate_and_prepare_audio(audio_bytes: bytes, chunk_index: int) -> tuple[bytes, str, str]:
    """
    Validates audio file and prepares it for STT API.
    Returns: (output_bytes, file_extension, mime_type)
    Raises STTError if audio is invalid or corrupted.
    """
    if not audio_bytes or len(audio_bytes) < 100:
        raise STTError(
            message=f"Audio chunk {chunk_index} could not be processed because the audio file is empty or too small ({len(audio_bytes) if audio_bytes else 0} bytes).",
            error_code="INVALID_MEDIA_FILE",
            status_code=400,
            retryable=False,
            chunk_index=chunk_index,
        )

    # Attempt FFmpeg conversion to WAV
    wav_bytes = _convert_to_wav(audio_bytes, chunk_index)
    if wav_bytes and len(wav_bytes) > 44:
        print(f"[STT] Chunk {chunk_index} ffmpeg validation: PASS (converted to {len(wav_bytes)}B WAV)")
        return wav_bytes, ".wav", "audio/wav"

    # FFmpeg failed or not available. Inspect container magic bytes for raw fallbacks.
    print(f"[STT] Chunk {chunk_index} ffmpeg conversion notice — inspecting container magic bytes...")

    if _is_valid_audio_container(audio_bytes):
        print(f"[STT] Chunk {chunk_index} raw container validation: PASS ({len(audio_bytes)}B valid container)")
        # Determine MIME type based on header
        if audio_bytes.startswith(b"\x1a\x45\xdf\xa3"):
            return audio_bytes, ".webm", "audio/webm"
        elif audio_bytes.startswith(b"RIFF") and len(audio_bytes) >= 12 and audio_bytes[8:12] == b"WAVE":
            return audio_bytes, ".wav", "audio/wav"
        elif audio_bytes.startswith(b"OggS"):
            return audio_bytes, ".ogg", "audio/ogg"
        elif audio_bytes.startswith(b"ID3") or audio_bytes[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2", b"\xff\xe3"):
            return audio_bytes, ".mp3", "audio/mp3"
        elif audio_bytes.startswith(b"fLaC"):
            return audio_bytes, ".flac", "audio/flac"
        elif len(audio_bytes) >= 8 and audio_bytes[4:8] == b"ftyp":
            return audio_bytes, ".m4a", "audio/m4a"
        else:
            return audio_bytes, ".webm", "audio/webm"

    # Container check failed. DO NOT send raw invalid bytes to Groq!
    print(f"[STT] Chunk {chunk_index} ffmpeg conversion FAIL and container validation FAIL")
    raise STTError(
        message=f"Audio chunk {chunk_index} could not be processed because the audio file is invalid.",
        error_code="INVALID_MEDIA_FILE",
        status_code=400,
        retryable=False,
        chunk_index=chunk_index,
    )


def _is_valid_audio_container(b: bytes) -> bool:
    """
    Checks if raw bytes start with a known valid audio container signature.
    """
    if len(b) < 12:
        return False
    # WebM / EBML
    if b.startswith(b"\x1a\x45\xdf\xa3"):
        return True
    # RIFF WAVE
    if b.startswith(b"RIFF") and b[8:12] == b"WAVE":
        return True
    # Ogg
    if b.startswith(b"OggS"):
        return True
    # MP3 ID3 or Sync
    if b.startswith(b"ID3") or b[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2", b"\xff\xe3"):
        return True
    # FLAC
    if b.startswith(b"fLaC"):
        return True
    # MP4 / M4A / AAC
    if b[4:8] == b"ftyp" or b[:2] in (b"\xff\xf1", b"\xff\xf9"):
        return True
    return False


async def transcribe_chunk(audio_bytes: bytes, chunk_index: int, session_id: Optional[str] = None) -> dict:
    """
    Validates audio and sends chunk to STT API with automated retries.
    Returns normalized result:
    {
        "transcript": str,
        "words": [{"word": str, "start": float, "end": float}],
        "status": "ok"
    }
    """
    if not STT_API_KEY:
        raise STTError(
            message="STT API key is not configured in environment.",
            error_code="AUTH_FAILURE",
            status_code=401,
            retryable=False,
            session_id=session_id,
            chunk_index=chunk_index,
        )

    if not STT_API_URL:
        raise STTError(
            message="STT API URL is not configured in environment.",
            error_code="CONFIG_ERROR",
            status_code=400,
            retryable=False,
            session_id=session_id,
            chunk_index=chunk_index,
        )

    # 1. Validate & prepare audio file (raises non-retryable STTError if invalid)
    upload_bytes, file_ext, mime_type = validate_and_prepare_audio(audio_bytes, chunk_index)

    print(f"[STT] Chunk {chunk_index} audio size: {len(upload_bytes)} bytes ({mime_type})")

    # 2. Define API request execution
    async def _single_stt_request() -> dict:
        async with httpx.AsyncClient(timeout=STT_TIMEOUT) as client:
            if STT_PROVIDER == "deepgram":
                headers = {
                    "Authorization": f"Token {STT_API_KEY}",
                    "Content-Type": mime_type,
                }
                response = await client.post(
                    STT_API_URL,
                    headers=headers,
                    content=upload_bytes,
                )
            else:
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
                    files=files,
                )

        status_code = response.status_code

        if status_code != 200:
            err_text = response.text[:300]
            if status_code == 400:
                raise STTError(
                    message=f"Audio chunk {chunk_index} could not be processed because the audio file is invalid.",
                    error_code="INVALID_MEDIA_FILE",
                    status_code=400,
                    retryable=False,
                    session_id=session_id,
                    chunk_index=chunk_index,
                )
            elif status_code == 401:
                raise STTError(
                    message="Speech-to-text service authentication failed.",
                    error_code="AUTH_FAILURE",
                    status_code=401,
                    retryable=False,
                    session_id=session_id,
                    chunk_index=chunk_index,
                )
            elif status_code == 403:
                raise STTError(
                    message="Speech-to-text service access forbidden.",
                    error_code="FORBIDDEN",
                    status_code=403,
                    retryable=False,
                    session_id=session_id,
                    chunk_index=chunk_index,
                )
            elif status_code == 429:
                raise STTError(
                    message="Speech-to-text service is temporarily busy. Please try again.",
                    error_code="RATE_LIMIT",
                    status_code=429,
                    retryable=True,
                    session_id=session_id,
                    chunk_index=chunk_index,
                )
            elif status_code in (408, 500, 502, 503, 504):
                raise STTError(
                    message=f"Speech-to-text service temporary error (HTTP {status_code}).",
                    error_code="SERVER_ERROR",
                    status_code=status_code,
                    retryable=True,
                    session_id=session_id,
                    chunk_index=chunk_index,
                )
            else:
                raise STTError(
                    message=f"STT API request failed with status {status_code}: {err_text}",
                    error_code="API_ERROR",
                    status_code=status_code,
                    retryable=False,
                    session_id=session_id,
                    chunk_index=chunk_index,
                )

        res_json = response.json()
        return _normalize_stt_response(res_json, chunk_index, session_id)

    # 3. Execute with central retry utility
    try:
        return await execute_with_retry(
            func=_single_stt_request,
            provider="groq",
            operation="stt_transcription",
            session_id=session_id,
            chunk_index=chunk_index,
            max_attempts=3,
            initial_delay=2.0,
            backoff_factor=2.5,
            max_delay=15.0,
        )
    except STTError as e:
        print(f"[STT] Chunk {chunk_index} transcription FAILED: {e.message}")
        return {
            "transcript": "",
            "words": [],
            "status": "failed",
            "error_code": e.error_code,
            "error_message": e.message,
            "retryable": e.retryable,
        }
    except Exception as e:
        print(f"[STT] Chunk {chunk_index} unexpected failure: {e}")
        return {
            "transcript": "",
            "words": [],
            "status": "failed",
            "error_code": "UNEXPECTED_ERROR",
            "error_message": str(e),
            "retryable": False,
        }


def _normalize_stt_response(res: dict | list | str, chunk_index: int, session_id: Optional[str] = None) -> dict:
    """
    Normalizes STT API output and strictly validates presence of transcript and word-level timestamps.
    """
    if isinstance(res, str):
        raise STTError(
            message="STT API returned plain text string without required word-level timestamps.",
            error_code="MISSING_WORD_TIMESTAMPS",
            status_code=200,
            retryable=True,
            session_id=session_id,
            chunk_index=chunk_index,
        )

    if isinstance(res, list) and len(res) > 0:
        res = res[0]

    if not isinstance(res, dict):
        raise STTError(
            message="STT API returned invalid JSON structure.",
            error_code="INVALID_RESPONSE",
            status_code=200,
            retryable=True,
            session_id=session_id,
            chunk_index=chunk_index,
        )

    raw_text = ""
    all_words = []

    # 1. Deepgram format
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
                        start_val = float(w["start"])
                        end_val = float(w["end"])
                        if start_val >= 0 and end_val >= start_val:
                            all_words.append({
                                "word": str(w["word"]).strip(),
                                "start": round(start_val, 3),
                                "end": round(end_val, 3),
                            })

    # 2. Groq / OpenAI verbose_json format: res["words"]
    if not raw_text:
        raw_text = res.get("text") or res.get("transcript") or ""

    if not all_words and "words" in res and isinstance(res["words"], list):
        for w in res["words"]:
            if isinstance(w, dict) and "word" in w and "start" in w and "end" in w:
                start_val = float(w["start"])
                end_val = float(w["end"])
                if start_val >= 0 and end_val >= start_val:
                    all_words.append({
                        "word": str(w["word"]).strip(),
                        "start": round(start_val, 3),
                        "end": round(end_val, 3),
                    })

    # 3. Segments format
    if not all_words and "segments" in res and isinstance(res["segments"], list):
        for seg in res["segments"]:
            if isinstance(seg, dict) and "words" in seg and isinstance(seg["words"], list):
                for w in seg["words"]:
                    if isinstance(w, dict) and "word" in w and "start" in w and "end" in w:
                        start_val = float(w["start"])
                        end_val = float(w["end"])
                        if start_val >= 0 and end_val >= start_val:
                            all_words.append({
                                "word": str(w["word"]).strip(),
                                "start": round(start_val, 3),
                                "end": round(end_val, 3),
                            })

    combined_text = raw_text.strip()
    if not combined_text:
        raise STTError(
            message=f"Audio chunk {chunk_index} could not be transcribed (empty audio/transcript).",
            error_code="EMPTY_TRANSCRIPT",
            status_code=200,
            retryable=False,
            session_id=session_id,
            chunk_index=chunk_index,
        )

    if not all_words:
        raise STTError(
            message=f"STT API returned transcript without required word timestamps for chunk {chunk_index}.",
            error_code="MISSING_WORD_TIMESTAMPS",
            status_code=200,
            retryable=True,
            session_id=session_id,
            chunk_index=chunk_index,
        )

    print(f"[STT] Chunk {chunk_index}: transcript PASS ({len(combined_text)} chars), word timestamps PASS ({len(all_words)} words)")
    return {
        "transcript": combined_text,
        "words": all_words,
        "status": "ok"
    }


def _convert_to_wav(audio_bytes: bytes, chunk_index: int) -> Optional[bytes]:
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
            return None

        with open(tmp_out, "rb") as f:
            return f.read()

    except Exception as e:
        print(f"[STT] WAV conversion exception chunk {chunk_index}: {e}")
        return None
    finally:
        for p in [tmp_in, tmp_out]:
            try:
                if p and os.path.exists(p):
                    os.unlink(p)
            except Exception:
                pass
