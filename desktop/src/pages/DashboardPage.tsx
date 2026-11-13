import React from 'react';
import { MeetingModeSelector } from '../components/MeetingModeSelector';
import { RecordingControls } from '../components/RecordingControls';
import { WaveformVisualizer } from '../components/WaveformVisualizer';
import { NoteList } from '../components/NoteList';
import { MeetingMode, RecordingState } from '../types/recording';
import { AudioDeviceStatus, AudioLevelData } from '../types/electron';
import { NoteItem } from '../types/note';
import { SessionStatusResult, API_BASE_URL } from '../services/apiService';
import { UserProfile } from '../types/auth';
import { Sparkles } from 'lucide-react';

interface DashboardPageProps {
  user?: UserProfile | null;
  meetingMode: MeetingMode;
  onSelectMode: (mode: MeetingMode) => void;
  recordingState: RecordingState;
  durationFormatted: string;
  deviceStatus: AudioDeviceStatus;
  audioLevels: AudioLevelData;
  backendResult?: SessionStatusResult | null;
  errorMessage: string | null;
  uploadProgressText?: string;
  isMicMuted?: boolean;
  onToggleMicMute?: () => void;
  onStartRecording: (enableMic: boolean, enableSystem: boolean) => void;
  onStopRecording: () => void;
  notes: NoteItem[];
  onSelectNote: (note: NoteItem) => void;
  onDeleteNote?: (noteId: string) => Promise<boolean>;
  onDeleteAllNotes?: () => Promise<boolean>;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  user,
  meetingMode,
  onSelectMode,
  recordingState,
  durationFormatted,
  deviceStatus,
  audioLevels,
  backendResult,
  errorMessage,
  uploadProgressText,
  isMicMuted,
  onToggleMicMute,
  onStartRecording,
  onStopRecording,
  notes,
  onSelectNote,
  onDeleteNote,
  onDeleteAllNotes,
}) => {
  let docxUrl: string | null = null;
  if (backendResult?.docx_url) {
    docxUrl = backendResult.docx_url.startsWith('http')
      ? backendResult.docx_url
      : `${API_BASE_URL}${backendResult.docx_url}`;
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const userName = user?.displayName ? user.displayName.split(' ')[0] : 'there';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Hero Header Section */}
      <div className="hero-banner">
        <div>
          <div className="hero-title">
            {getGreeting()}, {userName}
          </div>
          <div className="hero-subtitle">
            Capture your meeting or class. NoteCraft will structure it automatically with AI.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(15, 118, 110, 0.1)', padding: '6px 12px', borderRadius: '999px', color: '#0F766E', fontWeight: 600, fontSize: '12px' }}>
          <Sparkles size={14} color="#0F766E" />
          <span>AI Engine Active</span>
        </div>
      </div>

      <MeetingModeSelector
        activeMode={meetingMode}
        onSelectMode={onSelectMode}
        disabled={recordingState !== 'idle' && recordingState !== 'completed' && recordingState !== 'error'}
      />

      <RecordingControls
        recordingState={recordingState}
        durationFormatted={durationFormatted}
        deviceStatus={deviceStatus}
        audioLevels={audioLevels}
        errorMessage={errorMessage}
        uploadProgressText={uploadProgressText}
        docxUrl={docxUrl}
        isMicMuted={isMicMuted}
        onToggleMicMute={onToggleMicMute}
        onStartRecording={onStartRecording}
        onStopRecording={onStopRecording}
        meetingMode={meetingMode}
      />

      <WaveformVisualizer recordingState={recordingState} audioLevels={audioLevels} />

      <NoteList
        notes={notes}
        onSelectNote={onSelectNote}
        onDeleteNote={onDeleteNote}
        onDeleteAllNotes={onDeleteAllNotes}
        onNavigateToDashboard={() => {}}
      />
    </div>
  );
};
