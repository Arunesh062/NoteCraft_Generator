# Phase 6 — Production Hardening & Security Audit

This document outlines the security, stability, lifecycle, resource management, and error handling audit for the NoteCraft Desktop application.

---

### Audit Summary & Findings

| Finding | File(s) | Risk | Recommended Fix | Severity |
|---|---|---|---|---|
| **1. Unprotected Recording Lifecycle State Transitions** | `desktop/src/hooks/useRecording.ts` | Users could potentially trigger a second recording while one is stopping/uploading or trigger duplicate `/finalize` requests. | Implement strict state machine guards checking `recordingState` transitions before allowing start/stop/finalize actions. | **HIGH** |
| **2. MediaRecorder & Stream Resource Cleanup Edge Cases** | `desktop/src/services/audioService.ts` | If recording fails or component unmounts mid-capture, audio tracks or intervals may remain active. | Wrap cleanup in `try/finally` blocks and expose explicit `cleanup()` method for app unmount/shutdown. | **HIGH** |
| **3. Infinite or Indefinite Backend Status Polling** | `desktop/src/hooks/useRecording.ts` | If backend pipeline stalls or hangs without returning `failed`/`ready`, status polling could run indefinitely. | Enforce a strict maximum polling timeout (e.g. 5 minutes) and set state to `error`/`timeout` gracefully. | **MEDIUM** |
| **4. Duplicate Note Creation Prevention** | `desktop/src/hooks/useRecording.ts` | Polling ticks or React re-renders could trigger `createRealRecordingNote` multiple times for the same session. | Track processed session IDs in a `ref` guard to ensure idempotent single-note creation per session. | **HIGH** |
| **5. Corrupted LocalStorage Parsing Safeguard** | `desktop/src/services/historyService.ts` | Malformed JSON in `localStorage` could throw unhandled exceptions during boot. | Ensure `try/catch` wrappers around all `localStorage.getItem` and `setItem` operations with fallback arrays. | **MEDIUM** |
| **6. Sensitive Data in Diagnostic Logs** | `desktop/src/services/apiService.ts`, `authService.ts` | Verbose logging could dump session notes, transcripts, or auth credentials into dev tools or system logs. | Sanitize logs to output only high-level status messages, HTTP error codes, and session IDs. | **MEDIUM** |
| **7. Temporary Audio File Accumulation** | `desktop/electron/audio/WindowsAudioCapture.ts` | Test recording audio files saved to `os.tmpdir()` might accumulate over time. | Add cleanup routines to delete old `notecraft_*.webm` test files from temporary directories on startup. | **LOW** |
| **8. DOCX Download Network Error Handling** | `desktop/src/components/NoteDetailModal.tsx` | Download links might fail silently if backend is offline or returns 404. | Provide clear error fallback and validation before opening external download URLs. | **LOW** |
| **9. Electron IPC & Preload Security Boundary** | `desktop/electron/main.ts`, `preload.ts` | Context isolation & sandbox must remain strictly enforced with minimal IPC surface. | Verify `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and restrict exposed preload methods. | **HIGH** |

---

### Key Recommendations for Production Hardening

1. **State Machine Explicit Guards**:
   - `idle` → `starting` → `recording` → `stopping` → `uploading` → `processing` → `completed` (or `error`).
   - Block `startRecording` if state is not `idle`, `completed`, or `error`.
   - Block `stopRecording` if state is not `recording`.

2. **Resource & Track Cleanup**:
   - Stop all `MediaStreamTrack` instances (mic and loopback video/audio).
   - Close `AudioContext` asynchronously.
   - Clear `levelCheckInterval` and `chunkEmitInterval` in all exit paths.

3. **Backend Polling & Timeout**:
   - Cap polling at 150 ticks (5 minutes).
   - If timeout occurs, inform the user: *"The backend is taking longer than expected. You can check your history later."*

4. **Security & Privacy**:
   - Keep `contextIsolation: true` and `sandbox: true` in Electron webPreferences.
   - Strip sensitive transcript payloads from console output.
