import { useState, useEffect, useRef } from 'react';
import { MeetingMode, RecordingState } from '../types/recording';
import { audioService } from '../services/audioService';
import { AudioDeviceStatus, AudioLevelData, AudioStats } from '../types/electron';
import {
  uploadChunkToBackend,
  finalizeSessionOnBackend,
  fetchSessionStatusFromBackend,
  SessionStatusResult,
} from '../services/apiService';
import { createRealRecordingNote } from '../services/historyService';
import { NoteItem } from '../types/note';

export const useRecording = (onNoteCreated?: (note: NoteItem) => void, userUid?: string | null) => {
  const [meetingMode, setMeetingMode] = useState<MeetingMode>('mom');
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [deviceStatus, setDeviceStatus] = useState<AudioDeviceStatus>({
    micAvailable: false,
    micDeviceName: null,
    systemAvailable: false,
    systemDeviceName: null,
  });

  const [audioLevels, setAudioLevels] = useState<AudioLevelData>({
    micLevel: 0,
    systemLevel: 0,
    combinedLevel: 0,
  });

  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [latestStats, setLatestStats] = useState<AudioStats | null>(null);
  const [backendResult, setBackendResult] = useState<SessionStatusResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadProgressText, setUploadProgressText] = useState<string>('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const inFlightUploadsRef = useRef<Promise<{ ok: boolean; error?: string }>[]>([]);
  const processedSessionsRef = useRef<Set<string>>(new Set());
  const userUidRef = useRef<string | null | undefined>(userUid);
  const sessionTokenRef = useRef<number>(0);

  const resetRecordingState = () => {
    stopPolling();
    audioService.stopCapture().catch(() => null);
    setRecordingState('idle');
    setLatestStats(null);
    setBackendResult(null);
    setErrorMessage(null);
    setSecondsElapsed(0);
    setUploadProgressText('');
    inFlightUploadsRef.current = [];
    processedSessionsRef.current = new Set();
    setIsMicMuted(false);
  };

  useEffect(() => {
    // Identity Isolation Guard: Invalidate active recording session and clear transient results when user identity changes
    sessionTokenRef.current += 1;
    resetRecordingState();
    userUidRef.current = userUid;
  }, [userUid]);

  const refreshDeviceStatus = async () => {
    const status = await audioService.getDeviceStatus();
    setDeviceStatus(status);
  };

  const toggleMicMute = () => {
    const nextMuted = !isMicMuted;
    setIsMicMuted(nextMuted);
    audioService.setMicMuted(nextMuted);
  };

  useEffect(() => {
    refreshDeviceStatus();

    const interval = setInterval(() => {
      if (recordingState === 'idle') {
        refreshDeviceStatus();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [recordingState]);

  useEffect(() => {
    if (recordingState === 'recording') {
      timerRef.current = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (recordingState === 'idle') {
        setSecondsElapsed(0);
        setAudioLevels({ micLevel: 0, systemLevel: 0, combinedLevel: 0 });
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [recordingState]);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopPolling();
      audioService.destroy().catch(() => null);
    };
  }, []);

  const handleChunkReady = (chunk: { audioBlob: Blob; sessionId: string; chunkIndex: number }) => {
    setUploadProgressText(`Uploading WebM audio chunk #${chunk.chunkIndex + 1}...`);

    const promise = uploadChunkToBackend({
      audioBlob: chunk.audioBlob,
      sessionId: chunk.sessionId,
      chunkIndex: chunk.chunkIndex,
      mode: meetingMode,
      participants: [],
      speakerTimeline: [],
    }).then((res) => {
      if (res.ok) {
        setUploadProgressText(`Chunk #${chunk.chunkIndex + 1} uploaded successfully`);
      } else {
        setUploadProgressText(`Chunk #${chunk.chunkIndex + 1} upload failed`);
      }
      return res;
    });

    inFlightUploadsRef.current.push(promise);
  };

  const startRecording = async (enableMic = true, enableSystem = true) => {
    // State Guard: Prevent starting if already recording, stopping, uploading, or processing
    if (
      recordingState !== 'idle' &&
      recordingState !== 'completed' &&
      recordingState !== 'error'
    ) {
      console.warn('[useRecording] Cannot start recording while state is:', recordingState);
      return;
    }

    stopPolling();
    setErrorMessage(null);
    setLatestStats(null);
    setBackendResult(null);
    setUploadProgressText('');
    inFlightUploadsRef.current = [];
    setIsMicMuted(false);
    setRecordingState('starting');

    const success = await audioService.startCapture({
      enableMic,
      enableSystem,
      onLevels: (levels) => {
        setAudioLevels(levels);
      },
      onError: (errMsg) => {
        setErrorMessage(errMsg);
        setRecordingState('error');
      },
      onChunkReady: handleChunkReady,
    });

    if (success) {
      setSecondsElapsed(0);
      setRecordingState('recording');
    } else {
      setRecordingState('error');
      if (!errorMessage) {
        setErrorMessage('Failed to start audio recording stream.');
      }
    }
  };

  const stopRecording = async () => {
    // State Guard: Only allow stop when currently recording
    if (recordingState !== 'recording') {
      console.warn('[useRecording] Cannot stop recording when state is:', recordingState);
      return;
    }

    const currentToken = sessionTokenRef.current;
    const sessionOwnerUid = userUid;

    setRecordingState('stopping');

    // 1. Stop audio capture and emit final chunk slice
    await audioService.stopCapture();

    if (sessionTokenRef.current !== currentToken || userUidRef.current !== sessionOwnerUid) {
      console.warn('[useRecording] User identity changed during stopCapture. Discarding result.');
      return;
    }

    const sessionId = audioService.getSessionId();

    // 2. Wait for all in-flight chunk upload promises to complete
    setRecordingState('uploading');
    setUploadProgressText('Completing audio chunk uploads to backend...');

    const uploadResults = await Promise.allSettled(inFlightUploadsRef.current);
    if (sessionTokenRef.current !== currentToken || userUidRef.current !== sessionOwnerUid) {
      console.warn('[useRecording] User identity changed during chunk upload. Discarding result.');
      return;
    }

    const hasFailedUpload = uploadResults.some(
      (r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)
    );

    if (hasFailedUpload) {
      console.error('[useRecording] Audio chunk upload failed. Finalization aborted.');
      setErrorMessage('Audio chunk upload to backend failed. Finalization cancelled.');
      setRecordingState('error');
      return;
    }

    // 3. Trigger /finalize on backend
    setRecordingState('processing');
    setUploadProgressText('Audio upload complete. Starting note generation pipeline...');

    const finRes = await finalizeSessionOnBackend({
      sessionId,
      mode: meetingMode,
      participants: [],
      speakerTimeline: [],
    });

    if (sessionTokenRef.current !== currentToken || userUidRef.current !== sessionOwnerUid) {
      console.warn('[useRecording] User identity changed during finalize call. Discarding result.');
      return;
    }

    if (!finRes.ok) {
      console.error('[useRecording] /finalize call failed:', finRes.error);
      setErrorMessage(finRes.error || 'Failed to trigger backend note generation.');
      setRecordingState('error');
      return;
    }

    // 4. Poll /status?session_id=<id> every 2 seconds with timeout guard (max 150 polls = 5 mins)
    setUploadProgressText('Processing meeting audio with Groq Whisper & LLM...');

    stopPolling();
    let pollCount = 0;
    const maxPolls = 150; // 5 minutes max

    pollingRef.current = setInterval(async () => {
      pollCount++;

      // Identity & Session Token Guard: Discard polling output if user changed during processing
      if (sessionTokenRef.current !== currentToken || userUidRef.current !== sessionOwnerUid) {
        stopPolling();
        console.warn('[useRecording] User identity changed during status polling. Aborting polling.');
        return;
      }

      if (pollCount > maxPolls) {
        stopPolling();
        console.warn(`[useRecording] Polling timeout reached for session ${sessionId}`);
        setErrorMessage('The backend is taking longer than expected. You can check again later.');
        setRecordingState('error');
        return;
      }

      const statusRes = await fetchSessionStatusFromBackend(sessionId);
      if (sessionTokenRef.current !== currentToken || userUidRef.current !== sessionOwnerUid) {
        stopPolling();
        return;
      }

      if (!statusRes.ok) {
        console.warn('[useRecording] Status polling check notice:', statusRes.error);
        return;
      }

      const backendStatus = statusRes.data?.status;
      console.log(`[useRecording] Backend pipeline status for ${sessionId}: ${backendStatus} (poll #${pollCount})`);

      if (backendStatus === 'ready' || backendStatus === 'completed') {
        stopPolling();
        if (sessionTokenRef.current !== currentToken || userUidRef.current !== sessionOwnerUid) {
          return;
        }

        setBackendResult(statusRes.data || null);
        setRecordingState('completed');

        // Prevent duplicate note creation for the same session ID
        if (!processedSessionsRef.current.has(sessionId)) {
          processedSessionsRef.current.add(sessionId);
          const formattedDuration = formatDuration(secondsElapsed);
          const newNote = createRealRecordingNote(meetingMode, formattedDuration, statusRes.data, userUid);
          if (onNoteCreated) {
            onNoteCreated(newNote);
          }
        }
      } else if (backendStatus === 'failed') {
        stopPolling();
        if (sessionTokenRef.current !== currentToken || userUidRef.current !== sessionOwnerUid) {
          return;
        }
        setErrorMessage('Backend AI note generation pipeline failed.');
        setRecordingState('error');
      }
    }, 2000);
  };

  const formatDuration = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    meetingMode,
    setMeetingMode,
    recordingState,
    deviceStatus,
    audioLevels,
    secondsElapsed,
    durationFormatted: formatDuration(secondsElapsed),
    latestStats,
    backendResult,
    errorMessage,
    uploadProgressText,
    isMicMuted,
    toggleMicMute,
    refreshDeviceStatus,
    startRecording,
    stopRecording,
    resetRecordingState,
    clearLatestStats: () => setLatestStats(null),
  };
};
