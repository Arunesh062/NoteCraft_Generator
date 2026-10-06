import asyncio
import logging
import time
from typing import Callable, Awaitable, TypeVar, Optional, Any

logger = logging.getLogger("notecraft.retry")

T = TypeVar("T")

class ProviderError(Exception):
    """
    Base exception for external AI provider failures.
    """
    def __init__(
        self,
        message: str,
        provider: str,
        operation: str,
        error_code: str = "PROVIDER_ERROR",
        status_code: Optional[int] = None,
        retryable: bool = False,
        session_id: Optional[str] = None,
        chunk_index: Optional[int] = None,
    ):
        super().__init__(message)
        self.message = message
        self.provider = provider
        self.operation = operation
        self.error_code = error_code
        self.status_code = status_code
        self.retryable = retryable
        self.session_id = session_id
        self.chunk_index = chunk_index

    def __str__(self):
        target = f"Session {self.session_id}" if self.session_id else ""
        if self.chunk_index is not None:
            target += f" Chunk {self.chunk_index}"
        return f"[{self.provider.upper()}] {self.operation} {target} Error ({self.error_code}, HTTP {self.status_code}): {self.message}"


class STTError(ProviderError):
    def __init__(self, message: str, **kwargs):
        operation = kwargs.pop("operation", "stt_transcription")
        provider = kwargs.pop("provider", "groq")
        super().__init__(message, provider=provider, operation=operation, **kwargs)


class LLMError(ProviderError):
    def __init__(self, message: str, **kwargs):
        operation = kwargs.pop("operation", "llm_completion")
        provider = kwargs.pop("provider", "huggingface")
        super().__init__(message, provider=provider, operation=operation, **kwargs)


def parse_retry_after(headers: Any) -> Optional[float]:
    """
    Extracts Retry-After header as float seconds if available.
    """
    if not headers:
        return None
    val = headers.get("retry-after") or headers.get("Retry-After")
    if not val:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


async def execute_with_retry(
    func: Callable[[], Awaitable[T]],
    provider: str,
    operation: str,
    session_id: Optional[str] = None,
    chunk_index: Optional[int] = None,
    max_attempts: int = 3,
    initial_delay: float = 2.0,
    backoff_factor: float = 2.5,
    max_delay: float = 30.0,
) -> T:
    """
    Executes an async provider operation with exponential backoff retry.
    Distinguishes retryable vs non-retryable errors.
    """
    chunk_context = f"Chunk {chunk_index}" if chunk_index is not None else ""
    session_context = f"Session {session_id}" if session_id else ""
    context_str = " ".join(filter(None, [session_context, chunk_context]))

    last_exception = None

    for attempt in range(1, max_attempts + 1):
        log_prefix = f"[{provider.upper()}] {operation}"
        if context_str:
            log_prefix += f" ({context_str})"
        print(f"{log_prefix} attempt {attempt}/{max_attempts}")

        try:
            result = await func()
            print(f"{log_prefix} attempt {attempt}/{max_attempts}: PASS")
            return result

        except ProviderError as e:
            last_exception = e
            # Non-retryable provider error
            if not e.retryable or attempt == max_attempts:
                print(f"{log_prefix} attempt {attempt}/{max_attempts} FAILED (non-retryable or max attempts reached): {e.message}")
                raise e

            delay = min(max_delay, initial_delay * (backoff_factor ** (attempt - 1)))
            print(f"{log_prefix} HTTP {e.status_code or 'N/A'} retryable error: {e.message}. Retrying in {delay:.1f}s...")
            await asyncio.sleep(delay)

        except Exception as e:
            # Handle httpx or unexpected exceptions
            status_code = getattr(e, "status_code", None)
            if hasattr(e, "response") and getattr(e.response, "status_code", None):
                status_code = e.response.status_code

            response_headers = getattr(e, "headers", None)
            if hasattr(e, "response") and getattr(e.response, "headers", None):
                response_headers = e.response.headers

            retry_after = parse_retry_after(response_headers)

            # Check status code classification
            retryable = True
            error_code = "UNEXPECTED_ERROR"
            error_msg = str(e)

            if status_code == 402:
                retryable = False
                error_code = "LLM_CREDITS_EXHAUSTED"
                error_msg = "AI generation is temporarily unavailable because the LLM provider credits are exhausted."
            elif status_code in (400, 401, 403):
                retryable = False
                if status_code == 401:
                    error_code = "AUTH_FAILURE"
                    error_msg = f"{provider.upper()} API authentication failed. Check configured API key."
                elif status_code == 403:
                    error_code = "FORBIDDEN"
                    error_msg = f"{provider.upper()} API access forbidden."
                else:
                    error_code = "INVALID_REQUEST"
                    error_msg = f"Invalid request sent to {provider.upper()} API."

            elif status_code == 429:
                error_code = "RATE_LIMIT"
                error_msg = f"{provider.upper()} API rate limit reached."
            elif status_code in (408, 500, 502, 503, 504):
                error_code = "SERVER_ERROR"
                error_msg = f"{provider.upper()} API server error (HTTP {status_code})."

            prov_err = ProviderError(
                message=error_msg,
                provider=provider,
                operation=operation,
                error_code=error_code,
                status_code=status_code,
                retryable=retryable,
                session_id=session_id,
                chunk_index=chunk_index,
            )
            last_exception = prov_err

            if not retryable or attempt == max_attempts:
                print(f"{log_prefix} attempt {attempt}/{max_attempts} FAILED: {error_msg}")
                raise prov_err

            delay = retry_after if retry_after is not None else min(max_delay, initial_delay * (backoff_factor ** (attempt - 1)))
            print(f"{log_prefix} retryable error ({type(e).__name__}, HTTP {status_code or 'N/A'}). Retrying in {delay:.1f}s...")
            await asyncio.sleep(delay)

    if last_exception:
        raise last_exception
    raise ProviderError(
        message=f"{operation} failed after {max_attempts} attempts",
        provider=provider,
        operation=operation,
        error_code="MAX_RETRIES_EXCEEDED",
        retryable=False,
        session_id=session_id,
        chunk_index=chunk_index,
    )
