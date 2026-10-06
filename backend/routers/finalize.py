import asyncio
from datetime import datetime
from fastapi import APIRouter, HTTPException
from models import FinalizeRequest
from session.store import (
    get_session,
    get_all_chunks,
    get_audio_chunk,
    create_session,
    get_failed_chunks,
    save_chunk,
    save_block_summaries,
    save_mom,
    save_urls,
    set_status,
    set_session_status,
)
from services.stt_client import transcribe_chunk
from services.llm_client import (
    clean_transcript,
    summarise_chunk,
    aggregate_block,
    generate_notes,
    refine_notes,
)
from services.retry import ProviderError, STTError, LLMError
from services.speaker_map import assign_speakers
from services.export import export_documents
from services import metrics_logger

router = APIRouter()

CHUNK_GROUP_SIZE = 5


# ── POST /finalize ─────────────────────────────────────────────
@router.post("/finalize")
async def finalize(request: FinalizeRequest):
    """
    Triggered when user clicks End Meeting.
    Runs full pipeline in background and returns status immediately.
    """
    session_id = request.session_id
    mode       = request.mode or "mom"

    if mode not in ["mom", "class_notes"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid mode. Allowed values: 'mom', 'class_notes'"
        )

    session = get_session(session_id)

    if not session:
        create_session(session_id, request.participants, [
            e.dict() for e in request.speaker_timeline
        ], mode=mode)
        session = get_session(session_id)
    else:
        session["mode"] = mode

    if request.speaker_timeline:
        session["speaker_timeline"] = [
            e.dict() for e in request.speaker_timeline
        ]
    if request.participants:
        session["participants"] = request.participants

    set_session_status(session_id, status="processing", stage="starting")
    asyncio.create_task(run_pipeline(session_id))

    return {"message": "Finalization started", "session_id": session_id}


# ── Full pipeline ──────────────────────────────────────────────
async def run_pipeline(session_id: str):
    """
    Executes NoteCraft finalization pipeline:
        1. Retry failed STT chunks
        2. Speaker mapping
        3. MAP-REDUCE aggregation
        4. Final Notes generation
        5. Refinement pass with controlled fallback
        6. Export PDF + DOCX
    """
    try:
        session = get_session(session_id)
        if not session:
            print(f"[FINALIZE] Session {session_id} not found")
            return
        mode = session.get("mode", "mom")

        # ── Step 1: Retry failed chunks ────────────────────────
        set_session_status(session_id, status="processing", stage="stt")
        failed = get_failed_chunks(session_id)
        if failed:
            print(f"[FINALIZE] Retrying {len(failed)} failed chunks for session {session_id}...")
            await _retry_failed_chunks(session_id, failed)

        # Re-check chunks after retries
        chunks = get_all_chunks(session_id)
        failed_chunks = [c for c in chunks if c.get("status") not in ("STT_COMPLETED", "ok")]

        if failed_chunks or not chunks:
            failed_chunk = failed_chunks[0] if failed_chunks else {}
            chunk_idx = failed_chunk.get("chunk_index", 0)
            err_code = failed_chunk.get("error_code", "STT_FAILED")
            err_msg = failed_chunk.get("error_message") or f"Audio processing failed for chunk {chunk_idx}. Please retry the recording."
            retryable = failed_chunk.get("retryable", False)

            print(f"[FINALIZE] Atomic Pipeline HALT: Chunk {chunk_idx} failed permanently ({err_code}: {err_msg})")
            set_session_status(
                session_id=session_id,
                status="failed",
                stage="stt",
                provider="groq",
                error_code=err_code,
                message=err_msg,
                retryable=retryable,
            )
            metrics_logger.finalize_metrics(session_id, status="failed")
            return

        # ── Step 2: Speaker mapping ────────────────────────────
        set_session_status(session_id, status="processing", stage="speaker_mapping")
        print(f"[FINALIZE] Running speaker mapping for session {session_id}...")
        speaker_timeline = session.get("speaker_timeline", [])
        tagged_transcript = assign_speakers(chunks, speaker_timeline)

        # ── Step 3: MAP-REDUCE — group chunks into blocks ──────
        set_session_status(session_id, status="processing", stage="block_summary", provider="huggingface")
        print(f"[FINALIZE] Running MAP-REDUCE aggregation for session {session_id}...")
        block_summaries = await _aggregate_blocks(session_id, chunks)
        save_block_summaries(session_id, block_summaries)

        # ── Step 4: Generate final Notes JSON ──────────────────
        set_session_status(session_id, status="processing", stage="final_generation", provider="huggingface")
        print(f"[FINALIZE] Generating final Notes (mode={mode}) for session {session_id}...")
        participants = session.get("participants", [])
        meeting_date = datetime.now().strftime("%Y-%m-%d")

        speaker_timeline = session.get("speaker_timeline", [])
        duration_minutes = "Unknown"
        if speaker_timeline:
            last_timestamp = speaker_timeline[-1].get("timestamp_ms", 0)
            mins = round(last_timestamp / (1000 * 60))
            duration_minutes = str(mins) if mins > 0 else "< 1"
        elif chunks:
            mins = round((len(chunks) * 30) / 60)
            duration_minutes = str(mins) if mins > 0 else "< 1"

        notes_json = await generate_notes(
            block_summaries=block_summaries,
            participants=participants,
            meeting_date=meeting_date,
            duration_minutes=duration_minutes,
            mode=mode,
            session_id=session_id
        )

        # ── Step 5: Refinement pass ────────────────────────────
        set_session_status(session_id, status="processing", stage="final_refinement", provider="huggingface")
        print(f"[FINALIZE] Refining Notes (mode={mode}) for session {session_id}...")
        
        final_json = notes_json
        warnings = []
        try:
            refined_json = await refine_notes(notes_json, session_id=session_id)
            if refined_json and isinstance(refined_json, dict):
                final_json = refined_json
        except (LLMError, ProviderError) as e:
            print(f"[FINALIZE] Refinement pass failed ({e.error_code}): {e.message}")
            if notes_json and isinstance(notes_json, dict):
                print(f"[FINALIZE] Controlled Fallback: Using valid previous notes JSON.")
                final_json = notes_json
                warnings.append("Final refinement was unavailable; previous valid MoM was used.")
            else:
                raise e

        save_mom(session_id, final_json)

        # ── Step 6: Document export ────────────────────────────
        set_session_status(session_id, status="processing", stage="export")
        print(f"[FINALIZE] Exporting document for session {session_id}...")
        pdf_url, docx_url = export_documents(final_json, session_id)
        save_urls(session_id, pdf_url, docx_url)

        # Metrics
        raw_len = sum(len(c.get("raw", "")) for c in chunks)
        final_len = len(str(final_json))
        metrics_logger.set_compression_stats(session_id, raw_len, final_len)
        metrics_logger.finalize_metrics(session_id, status="completed")

        if warnings:
            set_session_status(
                session_id=session_id,
                status="ready_with_warnings",
                stage="complete",
                warnings=warnings,
            )
            print(f"[FINALIZE] Session {session_id} READY WITH WARNINGS: {warnings}")
        else:
            set_session_status(
                session_id=session_id,
                status="ready",
                stage="complete",
                warnings=[],
            )
            print(f"[FINALIZE] Session {session_id} READY")

    except ProviderError as e:
        print(f"[FINALIZE] Pipeline FAILED for session {session_id} ({e.error_code}): {e.message}")
        metrics_logger.finalize_metrics(session_id, status="failed")
        set_session_status(
            session_id=session_id,
            status="failed",
            stage=e.operation,
            provider=e.provider,
            error_code=e.error_code,
            message=e.message,
            retryable=e.retryable,
        )

    except Exception as e:
        print(f"[FINALIZE] Pipeline unexpected error for session {session_id}: {e}")
        metrics_logger.finalize_metrics(session_id, status="failed")
        set_session_status(
            session_id=session_id,
            status="failed",
            stage="pipeline",
            provider=None,
            error_code="UNEXPECTED_ERROR",
            message=f"Pipeline processing failed: {str(e)}",
            retryable=False,
        )


# ── Retry failed chunks ────────────────────────────────────────
async def _retry_failed_chunks(session_id: str, failed_indexes: list):
    """
    Attempts to re-process failed audio chunks using stored audio bytes.
    """
    from routers.chunks import process_chunk

    for chunk_index in sorted(failed_indexes):
        print(f"[FINALIZE] Retrying chunk {chunk_index} for session {session_id}...")
        audio_bytes = get_audio_chunk(session_id, chunk_index)
        if audio_bytes:
            await process_chunk(session_id, chunk_index, audio_bytes)
        else:
            print(f"[FINALIZE] Raw audio bytes unavailable for chunk {chunk_index}")


# ── MAP-REDUCE: group chunk summaries into block summaries ─────
async def _aggregate_blocks(session_id: str, chunks: list) -> list:
    """
    Groups every CHUNK_GROUP_SIZE chunk summaries into one
    block summary using LLMClient.
    """
    chunk_summaries = [
        c.get("summary", "") for c in chunks
        if c.get("status") in ("STT_COMPLETED", "ok") and c.get("summary")
    ]

    if not chunk_summaries:
        return ["No meeting content could be extracted."]

    groups = [
        chunk_summaries[i : i + CHUNK_GROUP_SIZE]
        for i in range(0, len(chunk_summaries), CHUNK_GROUP_SIZE)
    ]

    block_summaries = []
    total_blocks = len(groups)
    for i, group in enumerate(groups):
        print(f"[FINALIZE] Aggregating block {i+1}/{total_blocks}...")
        block_summary = await aggregate_block(group, i, session_id=session_id)
        block_summaries.append(block_summary)

    return block_summaries