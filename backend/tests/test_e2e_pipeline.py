import unittest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from session.store import (
    create_session,
    get_session,
    save_chunk,
    save_audio_chunk,
    delete_session,
)
from routers.finalize import run_pipeline
from services.retry import STTError, LLMError


class TestEndToEndPipeline(unittest.TestCase):
    def setUp(self):
        self.session_id = "test_e2e_session_001"
        delete_session(self.session_id)
        create_session(self.session_id, ["Alice", "Bob"], [], mode="mom")
        self.valid_webm_bytes = b"\x1a\x45\xdf\xa3" + b"\x00" * 1000

    def tearDown(self):
        delete_session(self.session_id)

    @patch("services.export.export_documents", return_value=("/outputs/test.pdf", "/outputs/test.docx"))
    @patch("routers.finalize.refine_notes")
    @patch("routers.finalize.generate_notes")
    @patch("routers.finalize._aggregate_blocks")
    @patch("services.stt_client.transcribe_chunk")
    def test_scenario_A_all_succeed(self, mock_stt, mock_agg, mock_gen, mock_refine, mock_export):
        """Scenario A: STT succeeds + LLM succeeds -> session status READY"""
        save_chunk(self.session_id, 0, {
            "chunk_index": 0, "raw": "Hello", "clean": "Hello", "summary": "Greeting", "words": [{"word": "Hello", "start": 0, "end": 1}], "status": "STT_COMPLETED"
        })
        mock_agg.return_value = ["Block 1 summary"]
        mock_gen.return_value = {"document_type": "mom", "session_title": "Meeting Title"}
        mock_refine.return_value = {"document_type": "mom", "session_title": "Meeting Title Refined"}

        asyncio.run(run_pipeline(self.session_id))

        session = get_session(self.session_id)
        self.assertEqual(session["status"], "ready")
        self.assertEqual(session["stage"], "complete")
        self.assertIsNotNone(session["docx_url"])

    @patch("services.export.export_documents", return_value=("/outputs/test.pdf", "/outputs/test.docx"))
    @patch("routers.finalize.refine_notes")
    @patch("routers.finalize.generate_notes")
    @patch("routers.finalize._aggregate_blocks")
    @patch("routers.chunks.transcribe_chunk")
    def test_scenario_B_stt_transient_failure_recovery(self, mock_stt, mock_agg, mock_gen, mock_refine, mock_export):
        """Scenario B: STT temporary failure -> retry during finalize -> succeeds -> READY"""
        save_audio_chunk(self.session_id, 0, self.valid_webm_bytes)
        save_chunk(self.session_id, 0, {
            "chunk_index": 0, "raw": "", "clean": "", "summary": "", "words": [], "status": "STT_FAILED", "error_code": "RATE_LIMIT"
        })

        mock_stt.return_value = {
            "transcript": "Recovered text",
            "words": [{"word": "Recovered", "start": 0, "end": 1}],
            "status": "ok"
        }
        mock_agg.return_value = ["Block summary"]
        mock_gen.return_value = {"document_type": "mom", "session_title": "Recovered Meeting"}
        mock_refine.return_value = {"document_type": "mom", "session_title": "Recovered Meeting Refined"}

        asyncio.run(run_pipeline(self.session_id))

        session = get_session(self.session_id)
        self.assertEqual(session["status"], "ready")

    @patch("services.export.export_documents")
    @patch("routers.chunks.transcribe_chunk")
    def test_scenario_C_stt_permanent_failure(self, mock_stt, mock_export):
        """Scenario C: STT permanent failure -> session FAILED (no DOCX)"""
        save_audio_chunk(self.session_id, 0, self.valid_webm_bytes)
        save_chunk(self.session_id, 0, {
            "chunk_index": 0, "raw": "", "clean": "", "summary": "", "words": [], "status": "STT_FAILED",
            "error_code": "INVALID_MEDIA_FILE", "error_message": "Audio file is invalid."
        })

        mock_stt.return_value = {
            "status": "failed", "error_code": "INVALID_MEDIA_FILE", "error_message": "Audio file is invalid."
        }

        asyncio.run(run_pipeline(self.session_id))

        session = get_session(self.session_id)
        self.assertEqual(session["status"], "failed")
        self.assertEqual(session["stage"], "stt")
        self.assertEqual(session["provider"], "groq")
        self.assertEqual(session["error_code"], "INVALID_MEDIA_FILE")
        self.assertIsNone(session["docx_url"])
        mock_export.assert_not_called()

    @patch("services.export.export_documents", return_value=("/outputs/test.pdf", "/outputs/test.docx"))
    @patch("routers.finalize.refine_notes")
    @patch("routers.finalize.generate_notes")
    @patch("routers.finalize._aggregate_blocks")
    def test_scenario_D_llm_transient_failure_recovery(self, mock_agg, mock_gen, mock_refine, mock_export):
        """Scenario D: LLM temporary failure -> retry succeeds -> READY"""
        save_chunk(self.session_id, 0, {
            "chunk_index": 0, "raw": "Text", "clean": "Text", "summary": "Sum", "words": [{"word": "Text", "start": 0, "end": 1}], "status": "STT_COMPLETED"
        })
        mock_agg.return_value = ["Block 1"]
        mock_gen.return_value = {"document_type": "mom", "session_title": "Title"}
        mock_refine.return_value = {"document_type": "mom", "session_title": "Refined"}

        asyncio.run(run_pipeline(self.session_id))

        session = get_session(self.session_id)
        self.assertEqual(session["status"], "ready")

    @patch("services.export.export_documents")
    @patch("routers.finalize._aggregate_blocks")
    def test_scenario_E_llm_402_credits_exhausted(self, mock_agg, mock_export):
        """Scenario E: LLM 402 -> session FAILED with clear error (no DOCX)"""
        save_chunk(self.session_id, 0, {
            "chunk_index": 0, "raw": "Text", "clean": "Text", "summary": "Sum", "words": [{"word": "Text", "start": 0, "end": 1}], "status": "STT_COMPLETED"
        })

        mock_agg.side_effect = LLMError(
            message="AI generation is temporarily unavailable because the LLM provider credits are exhausted.",
            error_code="LLM_CREDITS_EXHAUSTED",
            status_code=402,
            retryable=False,
            provider="huggingface",
            operation="block_summary"
        )

        asyncio.run(run_pipeline(self.session_id))

        session = get_session(self.session_id)
        self.assertEqual(session["status"], "failed")
        self.assertEqual(session["error_code"], "LLM_CREDITS_EXHAUSTED")
        self.assertIn("credits are exhausted", session["message"])
        self.assertIsNone(session["docx_url"])
        mock_export.assert_not_called()

    @patch("services.export.export_documents", return_value=("/outputs/test.pdf", "/outputs/test.docx"))
    @patch("routers.finalize.refine_notes")
    @patch("routers.finalize.generate_notes")
    @patch("routers.finalize._aggregate_blocks")
    def test_scenario_F_refinement_failure_controlled_fallback(self, mock_agg, mock_gen, mock_refine, mock_export):
        """Scenario F: Final refinement failure -> valid previous MoM fallback -> READY_WITH_WARNINGS"""
        save_chunk(self.session_id, 0, {
            "chunk_index": 0, "raw": "Text", "clean": "Text", "summary": "Sum", "words": [{"word": "Text", "start": 0, "end": 1}], "status": "STT_COMPLETED"
        })
        mock_agg.return_value = ["Block 1"]
        valid_unrefined_mom = {"document_type": "mom", "session_title": "Unrefined Valid MoM"}
        mock_gen.return_value = valid_unrefined_mom

        mock_refine.side_effect = LLMError(
            message="Refinement failed",
            error_code="REFINEMENT_FAILED",
            status_code=500,
            retryable=True,
            provider="huggingface",
            operation="final_refinement"
        )

        asyncio.run(run_pipeline(self.session_id))

        session = get_session(self.session_id)
        self.assertEqual(session["status"], "ready_with_warnings")
        self.assertEqual(len(session["warnings"]), 1)
        self.assertIn("previous valid MoM was used", session["warnings"][0])
        self.assertEqual(session["mom_json"], valid_unrefined_mom)
        self.assertIsNotNone(session["docx_url"])

    @patch("services.export.export_documents")
    @patch("routers.finalize.generate_notes")
    @patch("routers.finalize._aggregate_blocks")
    def test_scenario_G_no_docx_when_required_processing_fails(self, mock_agg, mock_gen, mock_export):
        """Scenario G: No DOCX generated when required processing fails"""
        save_chunk(self.session_id, 0, {
            "chunk_index": 0, "raw": "Text", "clean": "Text", "summary": "Sum", "words": [{"word": "Text", "start": 0, "end": 1}], "status": "STT_COMPLETED"
        })
        mock_agg.return_value = ["Block 1"]
        mock_gen.side_effect = LLMError(
            message="Generation failed",
            error_code="INVALID_LLM_RESPONSE",
            status_code=200,
            retryable=False,
            provider="huggingface",
            operation="final_generation"
        )

        asyncio.run(run_pipeline(self.session_id))

        session = get_session(self.session_id)
        self.assertEqual(session["status"], "failed")
        self.assertIsNone(session["docx_url"])
        mock_export.assert_not_called()


if __name__ == "__main__":
    unittest.main()
