import React, { useState } from 'react';
import { Mic, MicOff, Square, Loader2, Volume2, ShieldAlert, CheckCircle2, XCircle, Sparkles, Download } from 'lucide-react';
import { RecordingState, MeetingMode } from '../types/recording';
import { AudioDeviceStatus, AudioLevelData } from '../types/electron';

interface RecordingControlsProps {
  recordingState: RecordingState;
  durationFormatted: string;
  deviceStatus: AudioDeviceStatus;
  audioLevels: AudioLevelData;
  errorMessage: string | null;
  uploadProgressText?: string;
  docxUrl?: string | null;
  isMicMuted?: boolean;
  onToggleMicMute?: () => void;
  onStartRecording: (enableMic: boolean, enableSystem: boolean) => void;
  onStopRecording: () => void;
  meetingMode: MeetingMode;
}

export const RecordingControls: React.FC<RecordingControlsProps> = ({
  recordingState,
  durationFormatted,
  deviceStatus,
  audioLevels,
  errorMessage,
  uploadProgressText,
  docxUrl,
  isMicMuted = false,
  onToggleMicMute,
  onStartRecording,
  onStopRecording,
  meetingMode,
}) => {
  const [enableMic, setEnableMic] = useState(true);
  const [enableSystem, setEnableSystem] = useState(true);

  const isRecording = recordingState === 'recording';
  const isStarting = recordingState === 'starting';
  const isStopping = recordingState === 'stopping';
  const isUploading = recordingState === 'uploading';
  const isProcessing = recordingState === 'processing';
  const isCompleted = recordingState === 'completed';
  const isIdle = recordingState === 'idle' || isCompleted || recordingState === 'error';

  return (
    <div className="glass-card recording-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="card-title">
            <Mic size={18} color={isRecording ? '#EF4444' : '#0F766E'} />
            <span>Audio Capture & Recording Pipeline</span>
          </div>
          <div className="card-desc">
            Active Template: <strong>{meetingMode === 'mom' ? 'Minutes of Meeting (MoM)' : 'Class / Lecture Notes'}</strong>
          </div>
        </div>
      </div>

      {/* Real Device Availability & Stream Capture Status Indicators */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        <div
          className="stats-card"
          style={{
            borderColor: isRecording
              ? isMicMuted ? 'rgba(245, 158, 11, 0.6)' : 'rgba(20, 184, 166, 0.6)'
              : deviceStatus.micAvailable
              ? 'rgba(20, 184, 166, 0.3)'
              : 'rgba(239, 68, 68, 0.3)',
            background: 'var(--color-surface)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              {isRecording && isMicMuted ? (
                <MicOff size={15} color="#F59E0B" />
              ) : (
                <Mic size={15} color={isRecording ? '#14B8A6' : deviceStatus.micAvailable ? '#6B7280' : '#EF4444'} />
              )}
              Microphone Input
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: isRecording ? (isMicMuted ? '#F59E0B' : '#14B8A6') : deviceStatus.micAvailable ? '#6B7280' : '#EF4444',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {isRecording ? (
                isMicMuted ? (
                  <>
                    <MicOff size={13} color="#F59E0B" />
                    Microphone Muted
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={13} color="#14B8A6" />
                    Active (Mic ON)
                  </>
                )
              ) : deviceStatus.micAvailable ? (
                <>
                  <CheckCircle2 size={13} color="#6B7280" />
                  Ready
                </>
              ) : (
                <>
                  <XCircle size={13} color="#EF4444" />
                  Unavailable
                </>
              )}
            </span>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            {deviceStatus.micDeviceName || 'Checking Windows microphone availability...'}
          </div>

          {/* Real Audio Volume Meter */}
          {isRecording ? (
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--color-text-secondary)' }}>
                <span>Mic Level {isMicMuted ? '(Muted)' : ''}</span>
                <span>{isMicMuted ? '0%' : `${Math.round(audioLevels.micLevel * 100)}%`}</span>
              </div>
              <div style={{ height: '4px', background: 'var(--color-gray-200)', borderRadius: '2px', overflow: 'hidden', marginTop: '2px' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${isMicMuted ? 0 : Math.min(100, audioLevels.micLevel * 100)}%`,
                    background: isMicMuted ? '#F59E0B' : '#14B8A6',
                    transition: 'width 0.05s ease',
                  }}
                />
              </div>
            </div>
          ) : (
            <div style={{ marginTop: '6px', fontSize: '10px', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
              Stream inactive
            </div>
          )}
        </div>

        <div
          className="stats-card"
          style={{
            borderColor: isRecording
              ? 'rgba(45, 212, 191, 0.8)'
              : deviceStatus.systemAvailable
              ? 'rgba(45, 212, 191, 0.4)'
              : 'rgba(245, 158, 11, 0.4)',
            background: 'var(--color-surface)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Volume2 size={15} color={isRecording ? '#0F766E' : deviceStatus.systemAvailable ? '#6B7280' : '#F59E0B'} />
              System Audio (Loopback)
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: isRecording ? '#0F766E' : deviceStatus.systemAvailable ? '#6B7280' : '#F59E0B',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {isRecording ? (
                <>
                  <CheckCircle2 size={13} color="#0F766E" />
                  Active Loopback
                </>
              ) : deviceStatus.systemAvailable ? (
                <>
                  <CheckCircle2 size={13} color="#6B7280" />
                  Ready
                </>
              ) : (
                <>
                  <XCircle size={13} color="#F59E0B" />
                  Unavailable
                </>
              )}
            </span>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            Captures Teams, Zoom, Webex & System Playback
          </div>

          {/* Real Audio Volume Meter */}
          {isRecording ? (
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--color-text-secondary)' }}>
                <span>System Loopback Level</span>
                <span>{Math.round(audioLevels.systemLevel * 100)}%</span>
              </div>
              <div style={{ height: '4px', background: 'var(--color-gray-200)', borderRadius: '2px', overflow: 'hidden', marginTop: '2px' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, audioLevels.systemLevel * 100)}%`,
                    background: '#2DD4BF',
                    transition: 'width 0.05s ease',
                  }}
                />
              </div>
            </div>
          ) : (
            <div style={{ marginTop: '6px', fontSize: '10px', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
              Loopback inactive
            </div>
          )}
        </div>
      </div>

      {/* Audio Sources Selection */}
      <div style={{ display: 'flex', gap: '20px', fontSize: '13px', background: 'var(--color-surface)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-gray-200)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: isIdle ? 'pointer' : 'not-allowed', color: 'var(--color-text-primary)' }}>
          <input
            type="checkbox"
            checked={enableMic}
            onChange={(e) => setEnableMic(e.target.checked)}
            disabled={!isIdle || !deviceStatus.micAvailable}
          />
          <span>Include Microphone</span>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: isIdle ? 'pointer' : 'not-allowed', color: 'var(--color-text-primary)' }}>
          <input
            type="checkbox"
            checked={enableSystem}
            onChange={(e) => setEnableSystem(e.target.checked)}
            disabled={!isIdle || !deviceStatus.systemAvailable}
          />
          <span>Include System Audio (Teams / Zoom / Webex)</span>
        </label>
      </div>

      {/* Dynamic Recording & Processing Status Banner */}
      <div className="rec-status-banner">
        <div className="rec-state-info">
          <span className={`pulse-dot ${isRecording ? 'recording' : ''}`} />
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {isIdle && !isCompleted && 'Ready to capture'}
              {isStarting && 'Initializing Audio Pipeline...'}
              {isRecording && `Recording (${isMicMuted ? 'Mic Muted' : 'Mic Active'})`}
              {isStopping && 'Finalizing audio stream...'}
              {isUploading && 'Uploading WebM Chunks...'}
              {isProcessing && 'Processing Notes with AI...'}
              {isCompleted && '✓ Notes Generated'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              {isRecording && 'Streaming WebM audio chunks to backend every 30 seconds'}
              {uploadProgressText && uploadProgressText}
              {!isRecording && !uploadProgressText && isIdle && !isCompleted && 'Click Start Recording to begin live capture'}
              {isCompleted && 'Your structured notes and DOCX export are ready.'}
            </div>
          </div>
        </div>

        <div className="rec-timer">
          {isStarting || isStopping || isUploading || isProcessing ? (
            <Loader2 className="animate-spin" size={24} color="#3B82F6" />
          ) : isCompleted ? (
            <CheckCircle2 size={24} color="#14B8A6" />
          ) : (
            durationFormatted
          )}
        </div>
      </div>

      {/* Error Callout */}
      {errorMessage && (
        <div className="info-callout" style={{ borderColor: '#EF4444', color: '#EF4444', background: 'rgba(239, 68, 68, 0.08)' }}>
          <ShieldAlert size={18} style={{ flexShrink: 0 }} />
          <div>{errorMessage}</div>
        </div>
      )}

      {/* Completed State DOCX Download Action */}
      {isCompleted && docxUrl && (
        <div className="glass-card" style={{ padding: '14px', background: 'rgba(20, 184, 166, 0.08)', borderColor: '#14B8A6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={20} color="#14B8A6" />
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#0F766E' }}>Generated DOCX Ready</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Download complete meeting document created by FastAPI backend</div>
            </div>
          </div>
          <a
            href={docxUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="user-btn"
            style={{ background: '#0F766E', color: '#FFFFFF', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, border: 'none' }}
          >
            <Download size={16} />
            <span>Download DOCX</span>
          </a>
        </div>
      )}

      <div className="rec-actions">
        <button
          className="btn-record"
          onClick={() => onStartRecording(enableMic, enableSystem)}
          disabled={!isIdle || (!enableMic && !enableSystem) || isUploading || isProcessing}
          title={isIdle ? 'Start Audio Capture' : 'Recording active'}
        >
          <Mic size={18} />
          <span>Start Recording</span>
        </button>

        {isRecording && onToggleMicMute && (
          <button
            type="button"
            className="user-btn"
            style={{
              background: isMicMuted ? 'rgba(245, 158, 11, 0.15)' : 'var(--color-surface)',
              borderColor: isMicMuted ? '#F59E0B' : 'var(--color-primary)',
              color: isMicMuted ? '#F59E0B' : 'var(--color-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onClick={onToggleMicMute}
            title={isMicMuted ? 'Turn Microphone ON' : 'Turn Microphone OFF (Mute)'}
          >
            {isMicMuted ? <MicOff size={16} color="#F59E0B" /> : <Mic size={16} color="#0F766E" />}
            <span>{isMicMuted ? 'Mic Muted' : 'Mic Active'}</span>
          </button>
        )}

        <button
          className="btn-stop"
          onClick={onStopRecording}
          disabled={!isRecording}
          title={isRecording ? 'Stop Recording and Upload to Backend' : 'Recording inactive'}
        >
          <Square size={16} />
          <span>Stop Recording</span>
        </button>
      </div>
    </div>
  );
};
