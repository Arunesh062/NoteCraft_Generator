import unittest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
import httpx

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.llm_client import (
    _call_llm,
    generate_mom,
    refine_notes,
    LLMError,
)


class TestGroqLLMClient(unittest.TestCase):
    @patch("httpx.AsyncClient.post")
    def test_01_successful_generation(self, mock_post):
        """1. Successful generation"""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "choices": [{"message": {"content": "Generated AI text"}}]
        }
        mock_post.return_value = mock_resp

        res = asyncio.run(_call_llm("System", "User", session_id="test_session"))
        self.assertEqual(res, "Generated AI text")

    @patch("httpx.AsyncClient.post")
    def test_02_http_429_retried(self, mock_post):
        """2. 429 -> retry"""
        mock_resp_429 = MagicMock()
        mock_resp_429.status_code = 429
        mock_resp_429.headers = {"Retry-After": "0.01"}
        mock_resp_429.text = "Rate limit"

        mock_resp_200 = MagicMock()
        mock_resp_200.status_code = 200
        mock_resp_200.json.return_value = {
            "choices": [{"message": {"content": "Success after retry"}}]
        }

        mock_post.side_effect = [mock_resp_429, mock_resp_200]

        res = asyncio.run(_call_llm("System", "User", session_id="test_session"))
        self.assertEqual(res, "Success after retry")
        self.assertEqual(mock_post.call_count, 2)

    @patch("httpx.AsyncClient.post")
    def test_03_http_500_retried(self, mock_post):
        """3. 500 -> retry"""
        mock_resp_500 = MagicMock()
        mock_resp_500.status_code = 500
        mock_resp_500.text = "Internal Server Error"

        mock_resp_200 = MagicMock()
        mock_resp_200.status_code = 200
        mock_resp_200.json.return_value = {
            "choices": [{"message": {"content": "Success after 500"}}]
        }

        mock_post.side_effect = [mock_resp_500, mock_resp_200]

        res = asyncio.run(_call_llm("System", "User", session_id="test_session"))
        self.assertEqual(res, "Success after 500")

    @patch("httpx.AsyncClient.post")
    def test_04_timeout_retried(self, mock_post):
        """4. Timeout -> retry"""
        mock_resp_200 = MagicMock()
        mock_resp_200.status_code = 200
        mock_resp_200.json.return_value = {
            "choices": [{"message": {"content": "Success after timeout"}}]
        }

        mock_post.side_effect = [httpx.TimeoutException("Timeout"), mock_resp_200]

        res = asyncio.run(_call_llm("System", "User", session_id="test_session"))
        self.assertEqual(res, "Success after timeout")

    @patch("httpx.AsyncClient.post")
    def test_05_http_402_credits_exhausted_no_retry(self, mock_post):
        """5. 402 -> no retry, immediate failure with LLM_CREDITS_EXHAUSTED"""
        mock_resp_402 = MagicMock()
        mock_resp_402.status_code = 402
        mock_resp_402.text = "You have depleted your monthly included credits..."
        mock_post.return_value = mock_resp_402

        with self.assertRaises(LLMError) as ctx:
            asyncio.run(_call_llm("System", "User", session_id="test_session"))

        self.assertEqual(ctx.exception.error_code, "LLM_CREDITS_EXHAUSTED")
        self.assertFalse(ctx.exception.retryable)
        self.assertIn("credits are exhausted", ctx.exception.message)
        self.assertEqual(mock_post.call_count, 1)

    @patch("httpx.AsyncClient.post")
    def test_06_http_401_no_retry(self, mock_post):
        """6. 401 -> no retry"""
        mock_resp_401 = MagicMock()
        mock_resp_401.status_code = 401
        mock_resp_401.text = "Unauthorized"
        mock_post.return_value = mock_resp_401

        with self.assertRaises(LLMError) as ctx:
            asyncio.run(_call_llm("System", "User", session_id="test_session"))

        self.assertEqual(ctx.exception.error_code, "AUTH_FAILURE")
        self.assertFalse(ctx.exception.retryable)
        self.assertEqual(mock_post.call_count, 1)

    @patch("httpx.AsyncClient.post")
    def test_07_malformed_json_recovery_or_failure(self, mock_post):
        """7. Malformed JSON parsing recovery / failure"""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        # Valid JSON wrapped in markdown code blocks
        mock_resp.json.return_value = {
            "choices": [{"message": {"content": '```json\n{"session_title": "Parsed Title"}\n```'}}]
        }
        mock_post.return_value = mock_resp

        res = asyncio.run(generate_mom(["Block 1"], ["Alice"], "2026-10-06", session_id="test_session"))
        self.assertEqual(res["session_title"], "Parsed Title")

    @patch("httpx.AsyncClient.post")
    def test_08_empty_response_fails(self, mock_post):
        """8. Empty response -> failure"""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "choices": [{"message": {"content": "   "}}]
        }
        mock_post.return_value = mock_resp

        with self.assertRaises(LLMError) as ctx:
            asyncio.run(_call_llm("System", "User", session_id="test_session"))
        self.assertEqual(ctx.exception.error_code, "EMPTY_RESPONSE")

    @patch("httpx.AsyncClient.post")
    def test_09_refinement_failure_raises_llmerror(self, mock_post):
        """9. Refinement failure raises LLMError for controlled fallback handling"""
        mock_resp = MagicMock()
        mock_resp.status_code = 500
        mock_resp.text = "Server error"
        mock_post.return_value = mock_resp

        draft = {"session_title": "Draft Title"}
        with self.assertRaises(LLMError):
            asyncio.run(refine_notes(draft, session_id="test_session"))

    def test_10_live_groq_llm_request(self):
        """10. Real Groq Chat Completions API request verification"""
        from services.llm_client import LLM_API_KEY
        if not LLM_API_KEY:
            self.skipTest("LLM_API_KEY not set")

        res = asyncio.run(_call_llm(
            system_prompt="You are a helpful assistant.",
            user_prompt="Say 'Groq LLM Verified' and nothing else.",
            max_tokens=20,
            session_id="test_live_groq"
        ))
        self.assertIsNotNone(res)
        self.assertGreater(len(res), 0)
        print(f"[TEST LIVE GROQ LLM] Response: {res}")


if __name__ == "__main__":
    unittest.main()
