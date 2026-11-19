# NoteCraft – Groq LLM Integration Implementation Plan

**Branch:** `feature/groq-llm-integration`  
**Phase:** Phase 2 – Technical Review & Implementation Planning  
**Execution Mode:** Inspection-Only (Read-Only)  
**Date:** November 14, 2026  

---

## 1. Executive Summary & Current Implementation Status

A detailed technical review was conducted across `backend/services/llm_client.py`, `backend/main.py`, `backend/services/stt_client.py`, `backend/services/export.py`, configuration files, and the test suite to evaluate the exact changes required for completing the Groq LLM integration.

### Current State:
1. **Groq LLM Implementation (`services/llm_client.py`):**
   - The core service in `backend/services/llm_client.py` has already been adapted for the OpenAI-compatible Groq Chat Completions endpoint (`https://api.groq.com/openai/v1/chat/completions`).
   - Default environment lookup is `LLM_PROVIDER = os.getenv("LLM_PROVIDER", "groq").lower()`.
   - Default model in `llm_client.py` is `allam-2-7b`.
   - The request payload, Bearer token authorization, HTTP status code interception (402, 401, 403, 429, 5xx), and exponential backoff retry via `services/retry.py` are already wired for Groq.
2. **Outdated Defaults in `backend/main.py`:**
   - [backend/main.py](file:///d:/Github/NoteCraft_Generator/backend/main.py) still contains hardcoded fallbacks to `"huggingface"` and `"meta-llama/Llama-3.1-8B-Instruct"` on lines 44, 45, 62, and 64 in the `root()` (`GET /`) and `config_status()` (`GET /config-status`) route handlers.
3. **STT Independence:**
   - [backend/services/stt_client.py](file:///d:/Github/NoteCraft_Generator/backend/services/stt_client.py) (Groq Whisper Speech-to-Text) operates completely independently from the LLM service with zero coupling or shared mutable state.
4. **DOCX Schema Compatibility:**
   - Both Meeting Minutes (`mom`) and Class/Webinar Notes (`class_notes`) output schemas defined in `llm_client.py` align 100% with the extraction keys expected by `backend/services/export.py`.
5. **Testing Landscape:**
   - The test suite contains 26 fully mocked unit/integration tests and **2 live API tests** that consume real Groq tokens/credits (`test_llm.py::test_10_live_groq_llm_request` and `test_e2e_pipeline.py::test_scenario_H_live_e2e_groq_pipeline`).

---

## 2. Exact Files Requiring Changes

The finalization requires targeted modifications in only **2 application files** and verification of **2 configuration files**:

| File | Type | Reason for Modification |
| :--- | :--- | :--- |
| **`backend/main.py`** | Application Code | Remove legacy `"huggingface"` and `"meta-llama/Llama-3.1-8B-Instruct"` fallback defaults in `GET /` and `GET /config-status`. |
| **`backend/services/llm_client.py`** | Application Code | Align default model fallback and docstrings; ensure parameter bounds (`max_tokens`) adhere strictly to Groq specifications. |
| **`backend/.env.example`** | Configuration / Docs | Verify clarity of Groq configuration keys (`LLM_PROVIDER`, `LLM_API_URL`, `LLM_MODEL`). |
| **`render.yaml`** | Deployment Spec | Verify deployment env vars match the final model choice. |

---

## 3. Specific Changes Required in Each File

### A. `backend/main.py`
In `backend/main.py`, the fallback defaults returned when environment variables are omitted must be updated from Hugging Face to Groq:

```python
# --- BEFORE (Lines 44-46) ---
        "llm_provider": os.getenv("LLM_PROVIDER", "huggingface"),
        "llm_model": os.getenv("LLM_MODEL", "meta-llama/Llama-3.1-8B-Instruct"),

# --- AFTER ---
        "llm_provider": os.getenv("LLM_PROVIDER", "groq"),
        "llm_model": os.getenv("LLM_MODEL", "allam-2-7b"),

# --- BEFORE (Lines 62-64) ---
        "llm_provider": os.getenv("LLM_PROVIDER", "huggingface"),
        "llm_configured": bool(llm_url),
        "llm_model": os.getenv("LLM_MODEL", "meta-llama/Llama-3.1-8B-Instruct"),

# --- AFTER ---
        "llm_provider": os.getenv("LLM_PROVIDER", "groq"),
        "llm_configured": bool(llm_url),
        "llm_model": os.getenv("LLM_MODEL", "allam-2-7b"),
```
*(Note: If a different primary Groq model such as `llama-3.3-70b-versatile` or `llama-3.1-8b-instant` is preferred, the default should match).*

---

### B. `backend/services/llm_client.py`
1. **Docstrings & Comments:** Clean up remaining docstrings referencing Hugging Face (e.g. line 29: `"Calls external LLM (Hugging Face / OpenAI)"` &rarr; `"Calls external LLM (Groq / OpenAI)"`).
2. **Environment Variable Fallback:**
   ```python
   LLM_PROVIDER = os.getenv("LLM_PROVIDER", "groq").lower()
   LLM_API_URL  = (os.getenv("LLM_API_URL") or os.getenv("LLM_URL") or "https://api.groq.com/openai/v1/chat/completions").strip()
   LLM_API_KEY  = (os.getenv("LLM_API_KEY") or os.getenv("GROQ_API_KEY") or os.getenv("HF_TOKEN") or "").strip()
   MODEL        = os.getenv("LLM_MODEL", "allam-2-7b").strip()
   LLM_TIMEOUT  = float(os.getenv("LLM_TIMEOUT", "300.0"))
   ```
   *Action:* Keep `GROQ_API_KEY` and `LLM_API_KEY` as primary key lookups; keep `HF_TOKEN` purely as backwards-compatible fallback.
3. **Payload Construction:**
   Verify `_call_llm` payload structure:
   ```python
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
   ```
   Groq natively supports `max_tokens`, `temperature`, and `response_format={"type": "json_object"}`.

---

### C. `backend/.env.example`
Verify that `backend/.env.example` remains clean, valid, and contains:
```dotenv
ALLOWED_ORIGINS=

STT_PROVIDER=groq
STT_API_URL=https://api.groq.com/openai/v1/audio/transcriptions
STT_API_KEY=
STT_MODEL=whisper-large-v3-turbo
STT_TIMEOUT=120

LLM_PROVIDER=groq
LLM_API_URL=https://api.groq.com/openai/v1/chat/completions
LLM_API_KEY=
LLM_MODEL=allam-2-7b
LLM_TIMEOUT=300
```

---

### D. `render.yaml`
Confirm that lines 18-25 in `render.yaml` specify `LLM_PROVIDER: groq`, `LLM_API_URL: https://api.groq.com/openai/v1/chat/completions`, and `LLM_MODEL: allam-2-7b` (or chosen model). Currently, `render.yaml` is already synchronized with these values.

---

## 4. Potential Risks and Compatibility Concerns

### 1. Groq JSON Mode Prompt Requirement
- **Requirement:** When calling Groq with `response_format: {"type": "json_object"}`, Groq's API server requires the system prompt to explicitly contain the word `"json"`.
- **Status:** **Fully Compliant**.
  - `generate_mom`: Prompt contains `"Return ONLY valid JSON matching this schema: ..."`
  - `generate_class_notes`: Prompt contains `"Return ONLY valid JSON matching this schema: ..."`
  - `refine_mom`: Prompt contains `"Return ONLY valid JSON."`
- **Mitigation:** Ensure no future edits remove the word `"JSON"` from any prompt where `json_mode=True`.

### 2. Model Selection: `allam-2-7b` vs. Standard Groq Models
- **Risk:** `allam-2-7b` is an Arabic/English focused model. Depending on the Groq tier or region, standard models like `llama-3.3-70b-versatile` or `llama-3.1-8b-instant` may provide higher rate limits, wider availability, and superior English summarization.
- **Mitigation:** The system uses `os.getenv("LLM_MODEL")` dynamically, allowing easy switching between `allam-2-7b`, `llama-3.3-70b-versatile`, or `llama-3.1-8b-instant` without code changes.

### 3. Rate Limits & Exponential Backoff
- **Risk:** Groq enforces strict Requests-Per-Minute (RPM) and Tokens-Per-Minute (TPM) limits on developer tiers. Rapid consecutive chunk calls during long meetings could encounter HTTP 429.
- **Mitigation:**
  - `backend/services/retry.py` already includes exponential backoff (`initial_delay=2.0`, `backoff_factor=2.5`, `max_delay=15.0`).
  - `parse_retry_after()` dynamically honors Groq's `Retry-After` HTTP header.
  - The Map-Reduce block aggregation design reduces chunk volume before final note generation.

### 4. HTTP 402 Handling (Credit Exhaustion)
- **Status:** **Protected**. In `services/llm_client.py` line 71, HTTP 402 is marked with `retryable=False` and immediately terminates the pipeline with `LLM_CREDITS_EXHAUSTED`, preventing cascading retries and preventing corrupt DOCX creation.

### 5. DOCX Schema Integrity
- **Status:** **100% Compatible**. All fields generated by `generate_mom()` (`points_discussed`, `responsibility_matrix`, `information_items`, `members_present`, etc.) and `generate_class_notes()` (`topics_covered`, `detailed_notes`, `important_concepts`, `code_technical_examples`, etc.) directly map to `services/export.py`.

---

## 5. Local Testing Plan

To validate the integration safely without consuming credits or breaking sandbox rules, testing will follow a strictly staged approach:

```
+-----------------------------------------------------------------------------------+
|                            LOCAL TESTING STAGES                                   |
|                                                                                   |
|  [Stage 1: Syntax & Static Analysis]                                              |
|   - Compile all modified Python files (`py_compile`)                              |
|   - Verify no syntax errors, broken imports, or missing symbols                   |
|                                                                                   |
|  [Stage 2: Mocked Unit Tests (Zero External Requests)]                            |
|   - Run `tests/test_llm.py` (Mocked tests 1 through 9)                            |
|   - Run `tests/test_stt.py` (Mocked tests 1 through 10)                           |
|   - Run `tests/test_e2e_pipeline.py` (Mocked scenarios A through G)               |
|                                                                                   |
|  [Stage 3: Endpoint Response Validation]                                          |
|   - Verify `GET /` returns `"llm_provider": "groq"`                               |
|   - Verify `GET /config-status` returns `"llm_provider": "groq"`                  |
+-----------------------------------------------------------------------------------+
```

### Safe Execution Strategy:
- When executing the test suites locally, tests will be invoked using test filters that isolate mocked unit tests and explicitly prevent network requests:
  ```powershell
  # Safe Unit Test Targets (Zero API Calls)
  python -m unittest backend.tests.test_llm.TestGroqLLMClient.test_01_successful_generation
  python -m unittest backend.tests.test_llm.TestGroqLLMClient.test_04_http_402_fails_immediately_without_retry
  python -m unittest backend.tests.test_llm.TestGroqLLMClient.test_07_mom_generation_with_json_validation
  python -m unittest backend.tests.test_e2e_pipeline.TestEndToEndPipeline.test_scenario_A_all_succeed
  python -m unittest backend.tests.test_e2e_pipeline.TestEndToEndPipeline.test_scenario_E_llm_402_credits_exhausted
  ```

---

## 6. Tests That MUST Be Excluded Until Explicitly Approved

The following tests execute against live external APIs and **MUST NOT** be executed during automated verification:

| Test Identifier | File | Reason for Exclusion |
| :--- | :--- | :--- |
| **`test_10_live_groq_llm_request`** | `backend/tests/test_llm.py` | Makes a real HTTP request to `https://api.groq.com/openai/v1/chat/completions` and consumes real tokens/credits. |
| **`test_scenario_H_live_e2e_groq_pipeline`** | `backend/tests/test_e2e_pipeline.py` | Executes the complete live multi-step pipeline (transcription, cleaning, chunk summary, block summary, note generation, and refinement) using real Groq LLM API calls. Consumes substantial API credits. |

*These two tests will remain disabled/skipped during local unit verification and will only be executed if the user explicitly requests live end-to-end API verification.*

---

## 7. Implementation Checklist

- [ ] Modify `backend/main.py`: update default provider and model in `root()` and `config_status()`.
- [ ] Modify `backend/services/llm_client.py`: update comments/docstrings.
- [ ] Run Stage 1 static syntax verification (`python -m py_compile backend/main.py backend/services/llm_client.py`).
- [ ] Run Stage 2 mocked unit tests (excluding live tests).
- [ ] Review Git diff to confirm only intended minimal changes were made.
- [ ] Present completion summary and wait for user review.

