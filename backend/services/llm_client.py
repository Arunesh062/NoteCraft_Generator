import os
import json
import httpx
import time
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv

from services import metrics_logger
from services.retry import execute_with_retry, LLMError, ProviderError

load_dotenv()

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "huggingface").lower()
LLM_API_URL  = (os.getenv("LLM_API_URL") or os.getenv("LLM_URL") or "https://router.huggingface.co/v1/chat/completions").strip()
LLM_API_KEY  = (os.getenv("LLM_API_KEY") or os.getenv("HF_TOKEN") or "").strip()
MODEL        = os.getenv("LLM_MODEL", "meta-llama/Llama-3.1-8B-Instruct").strip()
LLM_TIMEOUT  = float(os.getenv("LLM_TIMEOUT", "300.0"))


async def _call_llm(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 2000,
    json_mode: bool = False,
    session_id: Optional[str] = None,
    operation: str = "llm_completion",
) -> str:
    """
    Calls external LLM (Hugging Face / OpenAI) with retry and error handling.
    """
    if not LLM_API_KEY:
        raise LLMError(
            message="AI generation configuration error. LLM API key is missing.",
            error_code="AUTH_FAILURE",
            status_code=401,
            retryable=False,
            session_id=session_id,
        )

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {LLM_API_KEY}",
    }

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": 0.3,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    async def _single_llm_call() -> str:
        start_time = time.time()
        async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
            response = await client.post(
                LLM_API_URL,
                headers=headers,
                json=payload,
            )

        latency = time.time() - start_time
        status_code = response.status_code

        if status_code != 200:
            err_text = response.text[:400]
            if status_code == 402:
                # Immediate non-retryable failure for credit depletion
                raise LLMError(
                    message="AI generation is temporarily unavailable because the LLM provider credits are exhausted.",
                    error_code="LLM_CREDITS_EXHAUSTED",
                    status_code=402,
                    retryable=False,
                    session_id=session_id,
                )
            elif status_code == 401:
                raise LLMError(
                    message="AI generation configuration error. Please contact the administrator.",
                    error_code="AUTH_FAILURE",
                    status_code=401,
                    retryable=False,
                    session_id=session_id,
                )
            elif status_code == 403:
                raise LLMError(
                    message="AI generation access forbidden. Please contact the administrator.",
                    error_code="FORBIDDEN",
                    status_code=403,
                    retryable=False,
                    session_id=session_id,
                )
            elif status_code == 400:
                raise LLMError(
                    message="Invalid request sent to AI generation provider.",
                    error_code="MALFORMED_REQUEST",
                    status_code=400,
                    retryable=False,
                    session_id=session_id,
                )
            elif status_code == 429:
                # Check for Retry-After header
                headers_map = getattr(response, "headers", {})
                raise LLMError(
                    message="AI generation service is temporarily busy. Please try again.",
                    error_code="RATE_LIMIT",
                    status_code=429,
                    retryable=True,
                    session_id=session_id,
                )
            elif status_code in (408, 500, 502, 503, 504):
                raise LLMError(
                    message=f"AI generation service temporary error (HTTP {status_code}).",
                    error_code="SERVER_ERROR",
                    status_code=status_code,
                    retryable=True,
                    session_id=session_id,
                )
            else:
                raise LLMError(
                    message=f"LLM API request failed with status {status_code}: {err_text}",
                    error_code="API_ERROR",
                    status_code=status_code,
                    retryable=False,
                    session_id=session_id,
                )

        result = response.json()
        content = ""

        if isinstance(result, dict) and "choices" in result and len(result["choices"]) > 0:
            content = result["choices"][0].get("message", {}).get("content", "")
        elif isinstance(result, list) and len(result) > 0:
            content = result[0].get("generated_text", "")
        elif isinstance(result, dict) and "generated_text" in result:
            content = result["generated_text"]

        content_clean = content.strip()
        if not content_clean:
            raise LLMError(
                message="LLM API returned an empty response.",
                error_code="EMPTY_RESPONSE",
                status_code=200,
                retryable=True,
                session_id=session_id,
            )

        if session_id:
            usage = result.get("usage", {}) if isinstance(result, dict) else {}
            completion_tokens = usage.get("completion_tokens", 0)
            if completion_tokens == 0:
                completion_tokens = len(content_clean.split()) * 1.3
            metrics_logger.log_llm_call(session_id, latency, int(completion_tokens))

        return content_clean

    return await execute_with_retry(
        func=_single_llm_call,
        provider="huggingface",
        operation=operation,
        session_id=session_id,
        max_attempts=3,
        initial_delay=2.0,
        backoff_factor=2.5,
        max_delay=15.0,
    )


def _parse_json(raw: str) -> dict | None:
    if not raw:
        return None
    clean = raw.strip()
    
    # Extract content between first '{' and last '}'
    try:
        start = clean.index("{")
        end   = clean.rindex("}") + 1
        json_content = clean[start:end]
    except ValueError:
        return None

    # Handle unescaped control characters inside string literals inline
    result = []
    in_string = False
    escape = False
    for char in json_content:
        if char == '"' and not escape:
            in_string = not in_string
            result.append(char)
        elif char == '\\' and in_string:
            escape = not escape
            result.append(char)
        else:
            if escape:
                escape = False
            if char == '\n' and in_string:
                result.append('\\n')
            elif char == '\r' and in_string:
                result.append('\\r')
            elif char == '\t' and in_string:
                result.append('\\t')
            else:
                result.append(char)
    json_content = "".join(result)

    try:
        return json.loads(json_content)
    except json.JSONDecodeError:
        pass

    import re
    json_content_cleaned = re.sub(r',\s*([\]}])', r'\1', json_content)
    try:
        return json.loads(json_content_cleaned)
    except Exception as e:
        print(f"[LLM] JSON Parsing failed: {e}")
        return None


async def clean_transcript(raw_transcript: str, session_id: Optional[str] = None) -> str:
    if not raw_transcript or not raw_transcript.strip():
        return raw_transcript

    system = (
        "You are a transcript editor. "
        "Clean the given transcript by removing filler words (uh, um, hmm, like), "
        "fixing obvious speech recognition errors, and removing repeated phrases. "
        "Do not summarise — preserve all content and meaning. "
        "Return only the cleaned transcript text, nothing else."
    )
    user = f"Clean this transcript:\n\n{raw_transcript}"
    try:
        cleaned = await _call_llm(system, user, session_id=session_id, operation="clean_transcript")
        return cleaned if cleaned else raw_transcript
    except LLMError as e:
        print(f"[LLM] clean_transcript failed ({e.error_code}): using raw transcript")
        return raw_transcript


async def summarise_chunk(
    clean_transcript_text: str,
    prev_summary: str = "",
    chunk_index: int = 0,
    session_id: Optional[str] = None
) -> str:
    system = (
        "You are a class note taker. "
        "Summarise the given class session segment in 3 to 5 bullet points. "
        "Focus on: topics explained, concepts taught, examples given, and questions asked. "
        "Be concise. Each bullet should be one clear sentence."
    )
    context = (
        f"Context from previous segment:\n{prev_summary}\n\n"
        if prev_summary and chunk_index > 0 else ""
    )
    user = f"{context}Summarise this class segment (segment {chunk_index + 1}):\n\n{clean_transcript_text}"
    return await _call_llm(system, user, session_id=session_id, operation="summarise_chunk")


async def aggregate_block(chunk_summaries: list, block_index: int, session_id: Optional[str] = None) -> str:
    system = (
        "You are a class note taker. "
        "You are given several segment summaries from an online class. "
        "Merge them into one coherent block summary. "
        "Remove redundancy. Preserve all topics, concepts, and examples. "
        "Write in continuous paragraphs, not bullet points."
    )
    summaries_text = "\n\n".join([f"Segment {i+1}:\n{s}" for i, s in enumerate(chunk_summaries)])
    user = f"Merge these summaries into one block summary:\n\n{summaries_text}"
    return await _call_llm(system, user, session_id=session_id, operation="block_summary")


async def generate_notes(
    block_summaries:  list,
    participants:     list,
    meeting_date:     str,
    duration_minutes: str = "Unknown",
    mode:             str = "mom",
    session_id:       Optional[str] = None,
    max_retries:      int = 3
) -> dict:
    if mode == "class_notes":
        return await generate_class_notes(
            block_summaries=block_summaries,
            participants=participants,
            meeting_date=meeting_date,
            duration_minutes=duration_minutes,
            session_id=session_id,
            max_retries=max_retries
        )
    else:
        return await generate_mom(
            block_summaries=block_summaries,
            participants=participants,
            meeting_date=meeting_date,
            duration_minutes=duration_minutes,
            session_id=session_id,
            max_retries=max_retries
        )


async def generate_mom(
    block_summaries:  list,
    participants:     list,
    meeting_date:     str,
    duration_minutes: str = "Unknown",
    session_id:       Optional[str] = None,
    max_retries:      int = 3
) -> dict:

    system = (
        "You are an expert Minute Taker and Documentation Specialist. "
        "Analyze the provided meeting summaries and generate structured Minutes of Meeting (MOM). "
        "Do NOT invent information that is not present in the transcript.\n\n"
        "Return ONLY valid JSON matching this schema:\n"
        "{\n"
        '  "document_type": "mom",\n'
        '  "session_title": "Descriptive Meeting Title",\n'
        '  "meeting_no": "2026-07/01",\n'
        '  "date": "YYYY-MM-DD",\n'
        '  "time": "10:00 AM - 11:30 AM",\n'
        '  "venue_platform": "Google Meet",\n'
        '  "members_present": ["Name 1", "Name 2"],\n'
        '  "points_discussed": [\n'
        '    {\n'
        '      "category_name": "Category Name",\n'
        '      "points": ["Point 1", "Point 2"]\n'
        '    }\n'
        '  ],\n'
        '  "responsibility_matrix": [\n'
        '    {\n'
        '      "category_name": "Category Name",\n'
        '      "responsibility": "Designated Person/Team",\n'
        '      "target_date": "DD.MM.YYYY or Continuous"\n'
        '    }\n'
        '  ],\n'
        '  "information_items": [\n'
        '    "Informational notice 1"\n'
        '  ],\n'
        '  "copy_to": ["Recipient 1"],\n'
        '  "copy_submitted_to": ["Management"],\n'
        '  "signatory_name": "Name of Secretary / Convener",\n'
        '  "signatory_designation": "Designation / Role",\n'
        '  "signature_date": "YYYY-MM-DD"\n'
        "}"
    )

    summaries_text = "\n\n".join(
        [f"Block {i+1}:\n{s}" for i, s in enumerate(block_summaries)]
    )
    user = (
        f"Meeting date: {meeting_date}\n"
        f"Scraped Attendees: {', '.join(participants) if participants else 'Participants'}\n"
        f"Meeting Duration: {duration_minutes} minutes\n\n"
        f"Meeting summaries:\n{summaries_text}\n\n"
        f"Generate the Minutes of Meeting JSON now following the exact schema required."
    )

    last_error = None
    for attempt in range(max_retries):
        if session_id:
            metrics_logger.log_json_attempt(session_id, success=False)
            
        print(f"[LLM] Generating MoM (Attempt {attempt + 1}/{max_retries})...")
        try:
            response = await _call_llm(system, user, max_tokens=4000, json_mode=True, session_id=session_id, operation="final_generation")
            parsed = _parse_json(response)
            if parsed and isinstance(parsed, dict):
                if session_id:
                    metrics_logger.session_metrics[session_id]["json_successes"] += 1
                parsed["document_type"] = "mom"
                if not parsed.get("date"):
                    parsed["date"] = meeting_date
                if not parsed.get("venue_platform"):
                    parsed["venue_platform"] = "Google Meet"
                if not parsed.get("members_present") and participants:
                    parsed["members_present"] = participants
                return parsed
            else:
                print(f"[LLM] MoM generation attempt {attempt + 1}: JSON parsing failed")
        except LLMError as e:
            last_error = e
            if not e.retryable:
                raise e

    if last_error:
        raise last_error
    raise LLMError(
        message="Failed to generate valid Minutes of Meeting JSON from LLM after retries.",
        error_code="INVALID_LLM_RESPONSE",
        status_code=200,
        retryable=False,
        session_id=session_id,
    )


async def generate_class_notes(
    block_summaries:  list,
    participants:     list,
    meeting_date:     str,
    duration_minutes: str = "Unknown",
    session_id:       Optional[str] = None,
    max_retries:      int = 3
) -> dict:

    system = (
        "You are an expert Educational Note Taker and Technical Documentation Specialist. "
        "Analyze the provided transcript summaries from a class, lecture, training session, technical session, webinar, or workshop. "
        "Your objective is to generate clear, structured study and reference notes. "
        "Do NOT create meeting minutes or action items unless specific tasks/assignments were assigned by the instructor. "
        "Preserve technical terminology and code snippets accurately when present in the transcript. "
        "Do NOT invent code, definitions, or examples that were not present in the transcript.\n\n"
        "Return ONLY valid JSON matching this schema:\n"
        "{\n"
        '  "document_type": "class_notes",\n'
        '  "session_title": "Descriptive Title",\n'
        '  "date": "YYYY-MM-DD",\n'
        '  "speaker_instructor": "Instructor or Speaker Name",\n'
        '  "session_type": "Class / Webinar / Lecture",\n'
        '  "overview": "High-level overview of the session",\n'
        '  "topics_covered": ["Topic 1", "Topic 2"],\n'
        '  "detailed_notes": [\n'
        '    {\n'
        '      "topic_title": "Topic Name",\n'
        '      "explanation": "Detailed explanation of concepts discussed",\n'
        '      "key_points": ["Key point 1", "Key point 2"]\n'
        '    }\n'
        '  ],\n'
        '  "important_concepts": [\n'
        '    {\n'
        '      "term_or_concept": "Term or Concept Name",\n'
        '      "definition_or_explanation": "Definition or explanation given"\n'
        '    }\n'
        '  ],\n'
        '  "examples_demonstrations": [\n'
        '    "Example or demonstration provided by speaker"\n'
        '  ],\n'
        '  "code_technical_examples": [\n'
        '    {\n'
        '      "language_or_context": "Programming language or tech context (e.g. Python, Java, SQL)",\n'
        '      "code_snippet": "Code snippet if present in transcript",\n'
        '      "explanation": "Explanation of the code example"\n'
        '    }\n'
        '  ],\n'
        '  "questions_and_answers": [\n'
        '    {\n'
        '      "question": "Question asked by attendee",\n'
        '      "answer": "Answer provided by speaker"\n'
        '    }\n'
        '  ],\n'
        '  "practical_tips": [\n'
        '    "Practical tip or recommendation mentioned"\n'
        '  ],\n'
        '  "key_takeaways": [\n'
        '    "Key takeaway 1", "Key takeaway 2"\n'
        '  ],\n'
        '  "final_summary": "Concise concluding summary of the session"\n'
        "}"
    )

    summaries_text = "\n\n".join(
        [f"Block {i+1}:\n{s}" for i, s in enumerate(block_summaries)]
    )
    user = (
        f"Session date: {meeting_date}\n"
        f"Scraped Attendees/Instructor: {', '.join(participants) if participants else 'Participants'}\n"
        f"Session Duration: {duration_minutes} minutes\n\n"
        f"Session summaries:\n{summaries_text}\n\n"
        f"Generate the Class / Webinar Notes JSON now following the exact schema required."
    )

    last_error = None
    for attempt in range(max_retries):
        if session_id:
            metrics_logger.log_json_attempt(session_id, success=False)

        print(f"[LLM] Generating Class Notes (Attempt {attempt + 1}/{max_retries})...")
        try:
            response = await _call_llm(system, user, max_tokens=4000, json_mode=True, session_id=session_id, operation="final_generation")
            parsed = _parse_json(response)
            if parsed and isinstance(parsed, dict):
                if session_id:
                    metrics_logger.session_metrics[session_id]["json_successes"] += 1
                parsed["document_type"] = "class_notes"
                if not parsed.get("date"):
                    parsed["date"] = meeting_date
                return parsed
            else:
                print(f"[LLM] Class Notes generation attempt {attempt + 1}: JSON parsing failed")
        except LLMError as e:
            last_error = e
            if not e.retryable:
                raise e

    if last_error:
        raise last_error
    raise LLMError(
        message="Failed to generate valid Class Notes JSON from LLM after retries.",
        error_code="INVALID_LLM_RESPONSE",
        status_code=200,
        retryable=False,
        session_id=session_id,
    )


async def refine_notes(draft_json: dict, session_id: Optional[str] = None, max_retries: int = 3) -> dict:
    return await refine_mom(draft_json, max_retries=max_retries, session_id=session_id)


async def refine_mom(draft_json: dict, max_retries: int = 3, session_id: Optional[str] = None) -> dict:
    system = (
        "You are a professional Document Editor. "
        "Refine and improve the given JSON Document (which is either Minutes of Meeting or Class/Webinar Notes). "
        "Fix grammar, improve tone, and ensure fields are strictly typed. "
        "Do NOT change the document_type or schema structure. Return ONLY valid JSON."
    )
    user = f"Refine this JSON:\n\n{json.dumps(draft_json, indent=2)}"

    last_error = None
    for attempt in range(max_retries):
        if session_id:
            metrics_logger.log_json_attempt(session_id, success=False)
            
        print(f"[LLM] Refining Notes (Attempt {attempt + 1}/{max_retries})...")
        try:
            response = await _call_llm(system, user, max_tokens=4000, json_mode=True, session_id=session_id, operation="final_refinement")
            parsed = _parse_json(response)
            if parsed and isinstance(parsed, dict):
                if session_id:
                    metrics_logger.session_metrics[session_id]["json_successes"] += 1
                return parsed
        except LLMError as e:
            last_error = e
            if not e.retryable:
                raise e

    if last_error:
        raise last_error
    raise LLMError(
        message="Failed to refine JSON output after retries.",
        error_code="REFINEMENT_FAILED",
        status_code=200,
        retryable=True,
        session_id=session_id,
    )
