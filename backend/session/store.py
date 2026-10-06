from typing import Dict, Any, List, Optional

# ── In-memory store ────────────────────────────────────────────
sessions: Dict[str, Any] = {}


def create_session(session_id: str, participants: List[str], speaker_timeline: List[dict], mode: str = "mom"):
    sessions[session_id] = {
        "status":           "processing",
        "stage":            "pending",
        "provider":         None,
        "error_code":       None,
        "message":          None,
        "retryable":        None,
        "warnings":         [],
        "mode":             mode,
        "participants":     participants,
        "speaker_timeline": speaker_timeline,
        "chunks":           {},
        "audio_chunks":     {},
        "block_summaries":  [],
        "mom_json":         None,
        "pdf_url":          None,
        "docx_url":         None,
    }


def save_mode(session_id: str, mode: str):
    if session_id in sessions:
        sessions[session_id]["mode"] = mode


def save_audio_chunk(session_id: str, chunk_index: int, audio_bytes: bytes):
    if session_id in sessions:
        sessions[session_id]["audio_chunks"][chunk_index] = audio_bytes


def get_audio_chunk(session_id: str, chunk_index: int) -> Optional[bytes]:
    return sessions.get(session_id, {}).get("audio_chunks", {}).get(chunk_index, None)


def save_chunk(session_id: str, chunk_index: int, data: dict):
    if session_id not in sessions:
        return
    sessions[session_id]["chunks"][chunk_index] = data


def get_chunk(session_id: str, chunk_index: int) -> dict:
    return sessions.get(session_id, {}).get("chunks", {}).get(chunk_index, {})


def get_all_chunks(session_id: str) -> List[dict]:
    chunks = sessions.get(session_id, {}).get("chunks", {})
    return [chunks[i] for i in sorted(chunks.keys())]


def get_failed_chunks(session_id: str) -> List[int]:
    chunks = sessions.get(session_id, {}).get("chunks", {})
    return [i for i, c in chunks.items() if c.get("status") in ("failed", "STT_FAILED")]


def set_status(session_id: str, status: str):
    if session_id in sessions:
        sessions[session_id]["status"] = status


def set_session_status(
    session_id: str,
    status: str,
    stage: Optional[str] = None,
    provider: Optional[str] = None,
    error_code: Optional[str] = None,
    message: Optional[str] = None,
    retryable: Optional[bool] = None,
    warnings: Optional[List[str]] = None,
):
    if session_id in sessions:
        s = sessions[session_id]
        s["status"] = status
        if stage is not None:
            s["stage"] = stage
        if provider is not None:
            s["provider"] = provider
        if error_code is not None:
            s["error_code"] = error_code
        if message is not None:
            s["message"] = message
        if retryable is not None:
            s["retryable"] = retryable
        if warnings is not None:
            s["warnings"] = warnings


def save_block_summaries(session_id: str, summaries: List[str]):
    if session_id in sessions:
        sessions[session_id]["block_summaries"] = summaries


def save_mom(session_id: str, mom_json: dict):
    if session_id in sessions:
        sessions[session_id]["mom_json"] = mom_json


def save_urls(session_id: str, pdf_url: str, docx_url: str):
    if session_id in sessions:
        sessions[session_id]["pdf_url"]  = pdf_url
        sessions[session_id]["docx_url"] = docx_url


def get_session(session_id: str) -> Optional[dict]:
    return sessions.get(session_id, None)


def delete_session(session_id: str):
    if session_id in sessions:
        del sessions[session_id]