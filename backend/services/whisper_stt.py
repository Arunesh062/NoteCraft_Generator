"""
NoteCraft AI — Speech-to-Text Migration Bridge
================================================
This module bridges legacy `whisper_stt` imports to the external HTTP `stt_client`.
No local GPU/CUDA/faster-whisper dependencies are loaded or required.
"""

from services.stt_client import transcribe_chunk

__all__ = ["transcribe_chunk"]