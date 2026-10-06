import unittest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
import httpx

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.stt_client import transcribe_chunk, validate_and_prepare_audio, STTError


class TestGroqSTTClient(unittest.TestCase):
    def setUp(self):
        # Valid 1-second WebM audio header mock bytes
        self.valid_webm_bytes = b"\x1a\x45\xdf\xa3" + b"\x00" * 2000
        self.invalid_media_bytes = b"CORRUPTED_RAW_BYTES_NOT_AUDIO" * 50

    def test_01_valid_audio_preparation(self):
        """1. Valid audio -> success"""
        bytes_out, file_ext, mime_type = validate_and_prepare_audio(self.valid_webm_bytes, chunk_index=1)
        self.assertTrue(len(bytes_out) > 0)
        self.assertIn(file_ext, [".webm", ".wav"])
        self.assertIn(mime_type, ["audio/webm", "audio/wav"])

    def test_02_empty_audio_fails(self):
        """2. Empty audio -> fail immediately"""
        with self.assertRaises(STTError) as ctx:
            validate_and_prepare_audio(b"", chunk_index=1)
        self.assertEqual(ctx.exception.error_code, "INVALID_MEDIA_FILE")
        self.assertFalse(ctx.exception.retryable)

    def test_03_invalid_media_fails_without_retry(self):
        """3. Invalid media -> fail without retry (and no raw bytes fallback)"""
        with patch("services.stt_client._convert_to_wav", return_value=None):
            with self.assertRaises(STTError) as ctx:
                validate_and_prepare_audio(self.invalid_media_bytes, chunk_index=1)
            self.assertEqual(ctx.exception.error_code, "INVALID_MEDIA_FILE")
            self.assertFalse(ctx.exception.retryable)

    @patch("httpx.AsyncClient.post")
    def test_04_http_429_retried(self, mock_post):
        """4. 429 -> retry"""
        mock_resp_429 = MagicMock()
        mock_resp_429.status_code = 429
        mock_resp_429.headers = {"Retry-After": "0.01"}
        mock_resp_429.text = "Rate limit exceeded"

        mock_resp_200 = MagicMock()
        mock_resp_200.status_code = 200
        mock_resp_200.json.return_value = {
            "text": "Hello world",
            "words": [{"word": "Hello", "start": 0.0, "end": 0.5}, {"word": "world", "start": 0.5, "end": 1.0}]
        }

        mock_post.side_effect = [mock_resp_429, mock_resp_200]

        res = asyncio.run(transcribe_chunk(self.valid_webm_bytes, chunk_index=1, session_id="test_session"))
        self.assertEqual(res["status"], "ok")
        self.assertEqual(res["transcript"], "Hello world")
        self.assertEqual(mock_post.call_count, 2)

    @patch("httpx.AsyncClient.post")
    def test_05_http_500_retried(self, mock_post):
        """5. 500 -> retry"""
        mock_resp_500 = MagicMock()
        mock_resp_500.status_code = 500
        mock_resp_500.text = "Internal Server Error"

        mock_resp_200 = MagicMock()
        mock_resp_200.status_code = 200
        mock_resp_200.json.return_value = {
            "text": "Server recovered",
            "words": [{"word": "Server", "start": 0.0, "end": 0.5}, {"word": "recovered", "start": 0.5, "end": 1.0}]
        }

        mock_post.side_effect = [mock_resp_500, mock_resp_200]

        res = asyncio.run(transcribe_chunk(self.valid_webm_bytes, chunk_index=1, session_id="test_session"))
        self.assertEqual(res["status"], "ok")
        self.assertEqual(res["transcript"], "Server recovered")
        self.assertEqual(mock_post.call_count, 2)

    @patch("httpx.AsyncClient.post")
    def test_06_timeout_retried(self, mock_post):
        """6. Timeout -> retry"""
        mock_resp_200 = MagicMock()
        mock_resp_200.status_code = 200
        mock_resp_200.json.return_value = {
            "text": "After timeout",
            "words": [{"word": "After", "start": 0.0, "end": 0.5}, {"word": "timeout", "start": 0.5, "end": 1.0}]
        }

        mock_post.side_effect = [httpx.TimeoutException("Timeout"), mock_resp_200]

        res = asyncio.run(transcribe_chunk(self.valid_webm_bytes, chunk_index=1, session_id="test_session"))
        self.assertEqual(res["status"], "ok")
        self.assertEqual(res["transcript"], "After timeout")

    @patch("httpx.AsyncClient.post")
    def test_07_http_401_fails_immediately(self, mock_post):
        """7. 401 -> fail immediately without retries"""
        mock_resp_401 = MagicMock()
        mock_resp_401.status_code = 401
        mock_resp_401.text = "Unauthorized"
        mock_post.return_value = mock_resp_401

        res = asyncio.run(transcribe_chunk(self.valid_webm_bytes, chunk_index=1, session_id="test_session"))
        self.assertEqual(res["status"], "failed")
        self.assertEqual(res["error_code"], "AUTH_FAILURE")
        self.assertFalse(res["retryable"])
        self.assertEqual(mock_post.call_count, 1)

    @patch("httpx.AsyncClient.post")
    def test_08_successful_response_with_word_timestamps(self, mock_post):
        """8. Successful response with word timestamps"""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "text": "NoteCraft testing",
            "words": [
                {"word": "NoteCraft", "start": 0.1, "end": 0.6},
                {"word": "testing", "start": 0.6, "end": 1.2}
            ]
        }
        mock_post.return_value = mock_resp

        res = asyncio.run(transcribe_chunk(self.valid_webm_bytes, chunk_index=1, session_id="test_session"))
        self.assertEqual(res["status"], "ok")
        self.assertEqual(len(res["words"]), 2)
        self.assertEqual(res["words"][0]["word"], "NoteCraft")

    @patch("httpx.AsyncClient.post")
    def test_09_response_without_word_timestamps_fails(self, mock_post):
        """9. Response without word timestamps -> fails cleanly"""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "text": "No word timestamps provided",
            "words": []
        }
        mock_post.return_value = mock_resp

        res = asyncio.run(transcribe_chunk(self.valid_webm_bytes, chunk_index=1, session_id="test_session"))
        self.assertEqual(res["status"], "failed")
        self.assertEqual(res["error_code"], "MISSING_WORD_TIMESTAMPS")

    def test_10_ffmpeg_conversion_failure_handling(self):
        """10. FFmpeg conversion failure does not fallback to invalid raw bytes"""
        with patch("services.stt_client._convert_to_wav", return_value=None):
            with self.assertRaises(STTError) as ctx:
                validate_and_prepare_audio(self.invalid_media_bytes, chunk_index=1)
            self.assertEqual(ctx.exception.error_code, "INVALID_MEDIA_FILE")


if __name__ == "__main__":
    unittest.main()
