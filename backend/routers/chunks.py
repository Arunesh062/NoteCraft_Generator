import json
import asyncio
import os
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from session.store import save_chunk, save_audio_chunk, get_session, create_session
from services.stt_client import transcribe_chunk
from services.llm_client import clean_transcript, summarise_chunk

router = APIRouter()

# ── POST /upload-chunk ─────────────────────────────────────────
@router.post("/upload-chunk")
async def upload_chunk(
    audio:            UploadFile = File(...),
    session_id:       str        = Form(...),
    chunk_index:      int        = Form(...),
    speaker_timeline: str        = Form(default="[]"),
    participants:     str        = Form(default="[]"),
    mode:             str        = Form(default="mom"),
):
    """
    Receives a single merged audio chunk (tab + mic) from the extension.
    """
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")

    try:
        timeline          = json.loads(speaker_timeline)
        participants_list = json.loads(participants)
    except json.JSONDecodeError:
        timeline          = []
        participants_list = []

    session = get_session(session_id)
    if not session:
        create_session(session_id, participants_list, timeline, mode=mode)

    audio_bytes = await audio.read()

    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file received")

    print(f"[CHUNKS] Chunk {chunk_index} received: {len(audio_bytes)}B for session {session_id}")

    # Store raw audio bytes in memory for session retries
    save_audio_chunk(session_id, chunk_index, audio_bytes)

    # Save chunk state as pending
    save_chunk(session_id, chunk_index, {
        "chunk_index": chunk_index,
        "raw":         "",
        "clean":       "",
        "summary":     "",
        "words":       [],
        "status":      "PENDING",
    })

    # Process chunk in background task
    asyncio.create_task(
        process_chunk(session_id, chunk_index, audio_bytes)
    )

    return {
        "message":     "Chunk received",
        "session_id":  session_id,
        "chunk_index": chunk_index,
    }


# ── Background task: STT → clean → summarise ──────────────────
async def process_chunk(session_id: str, chunk_index: int, audio_bytes: bytes):
    """
    Background worker processing STT, transcript cleaning, and segment summarization.
    """
    try:
        # Step 1: Speech to text
        stt_result = await transcribe_chunk(audio_bytes, chunk_index, session_id=session_id)

        if stt_result.get("status") == "failed":
            error_code = stt_result.get("error_code", "STT_FAILED")
            error_message = stt_result.get("error_message", "Speech-to-text processing failed.")
            print(f"[CHUNKS] Chunk {chunk_index} STT failed ({error_code}): {error_message}")
            save_chunk(session_id, chunk_index, {
                "chunk_index":    chunk_index,
                "raw":            "",
                "clean":          "",
                "summary":        "",
                "words":          [],
                "status":         "STT_FAILED",
                "error_code":     error_code,
                "error_message":  error_message,
                "retryable":      stt_result.get("retryable", False),
                "attempts":       3,
            })
            return

        raw_transcript = stt_result["transcript"]
        words          = stt_result["words"]

        # Step 2: Clean transcript
        cleaned = await clean_transcript(raw_transcript, session_id=session_id)

        # Step 3: Get previous chunk summary for context
        prev_summary = _get_prev_summary(session_id, chunk_index)

        # Step 4: Summarise this chunk
        summary = await summarise_chunk(
            clean_transcript_text=cleaned,
            prev_summary=prev_summary,
            chunk_index=chunk_index,
            session_id=session_id
        )

        save_chunk(session_id, chunk_index, {
            "chunk_index": chunk_index,
            "raw":         raw_transcript,
            "clean":       cleaned,
            "summary":     summary,
            "words":       words,
            "status":      "STT_COMPLETED",
        })

        print(f"[CHUNKS] Chunk {chunk_index} completed successfully for session {session_id}")

    except Exception as e:
        print(f"[CHUNKS] Chunk {chunk_index} unexpected processing error: {e}")
        save_chunk(session_id, chunk_index, {
            "chunk_index":   chunk_index,
            "raw":           "",
            "clean":         "",
            "summary":       "",
            "words":         [],
            "status":        "STT_FAILED",
            "error_code":    "UNEXPECTED_ERROR",
            "error_message": str(e),
            "retryable":     False,
            "attempts":      3,
        })


def _get_prev_summary(session_id: str, chunk_index: int) -> str:
    if chunk_index == 0:
        return ""
    from session.store import get_chunk
    prev = get_chunk(session_id, chunk_index - 1)
    return prev.get("summary", "")