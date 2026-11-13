import React, { useEffect, useState } from 'react';
import {
  Settings,
  User as UserIcon,
  Sliders,
  HardDrive,
  Info,
  ChevronDown,
  ChevronRight,
  Server,
  ShieldCheck,
  Cpu,
  RefreshCw,
  LogOut,
  Mic,
  Volume2,
  Trash2,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { isFirebaseConfigured } from '../services/firebase';
import { API_BASE_URL, checkBackendHealth } from '../services/apiService';
import { SystemInfo, AudioDeviceStatus } from '../types/electron';
import { UserProfile } from '../types/auth';
import { MeetingMode, RecordingState } from '../types/recording';

interface SettingsPageProps {
  user?: UserProfile | null;
  onLogout?: () => void;
  noteCount?: number;
  meetingMode?: MeetingMode;
  onSelectMeetingMode?: (mode: MeetingMode) => void;
  onSyncLocalNotes?: () => Promise<void>;
  onDeleteAllNotes?: () => Promise<boolean>;
  backendOnline?: boolean;
  deviceStatus?: AudioDeviceStatus;
  recordingState?: RecordingState;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  user,
  onLogout,
  noteCount = 0,
  meetingMode = 'mom',
  onSelectMeetingMode,
  onSyncLocalNotes,
  onDeleteAllNotes,
  backendOnline,
  deviceStatus,
  recordingState = 'idle',
}) => {
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [healthStatus, setHealthStatus] = useState<string>(
    backendOnline === true ? 'Connected (Operational)' : backendOnline === false ? 'Offline' : 'Checking...'
  );
  const [isChecking, setIsChecking] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const verifyBackend = async () => {
    setIsChecking(true);
    setHealthStatus('Pinging backend...');
    const result = await checkBackendHealth();
    setHealthStatus(result.online ? `Connected (${result.message})` : `Offline (${result.message})`);
    setIsChecking(false);
  };

  useEffect(() => {
    if (window.electronAPI?.getSystemInfo) {
      window.electronAPI.getSystemInfo().then(setSysInfo).catch(() => null);
    }
    verifyBackend();
  }, []);

  const isGuest = !user || user.isAnonymous;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div className="glass-card">
        <div className="card-title">
          <Settings size={20} color="#0F766E" />
          <span style={{ color: 'var(--color-text-primary)' }}>Settings & Preferences</span>
        </div>
        <div className="card-desc">Manage your NoteCraft Desktop account, recording options, and storage settings.</div>
      </div>

      {/* ACCOUNT */}
      <div className="glass-card">
        <div className="card-title">
          <UserIcon size={18} color="#0F766E" />
          <span style={{ color: 'var(--color-text-primary)' }}>Account & Session</span>
        </div>
        <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {!isGuest && user ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {user.displayName || 'NoteCraft User'}
                </div>
                <div style={{ color: 'var(--color-text-secondary)' }}>{user.email || 'Authenticated User'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  <span
                    className="mode-pill"
                    style={{ background: 'rgba(20, 184, 166, 0.15)', color: '#14B8A6', fontWeight: 700 }}
                  >
                    Cloud Account
                  </span>
                </div>
              </div>

              {onLogout && (
                <button
                  className="user-btn"
                  onClick={onLogout}
                  style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                    color: '#EF4444',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <LogOut size={15} />
                  <span>Sign Out</span>
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)' }}>Guest Mode</div>
                <div style={{ color: 'var(--color-text-secondary)' }}>
                  You are using NoteCraft Desktop in Guest Mode. Notes are saved to local storage on this device.
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  <span
                    className="mode-pill"
                    style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', fontWeight: 700 }}
                  >
                    Local Session
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PREFERENCES */}
      <div className="glass-card">
        <div className="card-title">
          <Sliders size={18} color="#0F766E" />
          <span style={{ color: 'var(--color-text-primary)' }}>Recording & Note-taking Preferences</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
          {/* Default Mode Selector */}
          <div>
            <label style={{ fontWeight: 700, color: 'var(--color-text-primary)', display: 'block', marginBottom: '8px' }}>
              Default Note-taking Mode:
            </label>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                className={`user-btn ${meetingMode === 'mom' ? 'active' : ''}`}
                style={{
                  background: meetingMode === 'mom' ? 'rgba(15, 118, 110, 0.12)' : '#FFFFFF',
                  borderColor: meetingMode === 'mom' ? '#0F766E' : 'var(--color-gray-200)',
                  color: meetingMode === 'mom' ? '#0F766E' : 'var(--color-text-secondary)',
                  fontWeight: meetingMode === 'mom' ? 700 : 500,
                  padding: '8px 16px',
                }}
                onClick={() => onSelectMeetingMode && onSelectMeetingMode('mom')}
              >
                Minutes of Meeting (MOM)
              </button>
              <button
                className={`user-btn ${meetingMode === 'class_notes' ? 'active' : ''}`}
                style={{
                  background: meetingMode === 'class_notes' ? 'rgba(15, 118, 110, 0.12)' : '#FFFFFF',
                  borderColor: meetingMode === 'class_notes' ? '#0F766E' : 'var(--color-gray-200)',
                  color: meetingMode === 'class_notes' ? '#0F766E' : 'var(--color-text-secondary)',
                  fontWeight: meetingMode === 'class_notes' ? 700 : 500,
                  padding: '8px 16px',
                }}
                onClick={() => onSelectMeetingMode && onSelectMeetingMode('class_notes')}
              >
                Class / Webinar Notes
              </button>
            </div>
          </div>

          {/* Audio Preferences Display */}
          <div style={{ borderTop: '1px solid var(--color-gray-200)', paddingTop: '12px' }}>
            <label style={{ fontWeight: 700, color: 'var(--color-text-primary)', display: 'block', marginBottom: '8px' }}>
              Audio Hardware & Preference Status:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
              <div style={{ background: 'var(--color-surface)', padding: '10px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Mic size={16} color="#0F766E" />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>Microphone</div>
                  <div style={{ fontSize: '11px', color: deviceStatus?.micAvailable ? '#14B8A6' : 'var(--color-text-secondary)' }}>
                    {deviceStatus?.micAvailable ? `Available (${deviceStatus.micDeviceName || 'Default Mic'})` : 'Ready'}
                  </div>
                </div>
              </div>

              <div style={{ background: 'var(--color-surface)', padding: '10px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Volume2 size={16} color="#0F766E" />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>System Audio</div>
                  <div style={{ fontSize: '11px', color: deviceStatus?.systemAvailable ? '#14B8A6' : 'var(--color-text-secondary)' }}>
                    {deviceStatus?.systemAvailable ? 'Available (WASAPI Loopback)' : 'Loopback Supported'}
                  </div>
                </div>
              </div>

              <div style={{ background: 'var(--color-surface)', padding: '10px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Sparkles size={16} color={recordingState === 'recording' ? '#EF4444' : 'var(--color-text-secondary)'} />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>Capture State</div>
                  <div style={{ fontSize: '11px', color: recordingState === 'recording' ? '#EF4444' : 'var(--color-text-secondary)', fontWeight: recordingState === 'recording' ? 700 : 400 }}>
                    {recordingState === 'recording' ? 'Capturing Audio...' : 'Not Capturing'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* NOTES & STORAGE */}
      <div className="glass-card">
        <div className="card-title">
          <HardDrive size={18} color="#14B8A6" />
          <span style={{ color: 'var(--color-text-primary)' }}>Notes & Storage</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cloud size={16} color={!isGuest ? '#14B8A6' : '#F59E0B'} />
                <span>Cloud Synchronization</span>
              </div>
              <div style={{ color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                {!isGuest
                  ? `Notes automatically sync to your cloud account (${noteCount} notes saved).`
                  : `Notes stored locally in browser storage (${noteCount} notes saved).`}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                className="status-pill"
                style={{
                  background: !isGuest ? 'rgba(20, 184, 166, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                  color: !isGuest ? '#14B8A6' : '#F59E0B',
                  borderColor: !isGuest ? 'rgba(20, 184, 166, 0.3)' : 'rgba(245, 158, 11, 0.3)',
                }}
              >
                {!isGuest ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                <span>{!isGuest ? 'Cloud Synced' : 'Local Storage Only'}</span>
              </span>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--color-gray-200)', paddingTop: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {onSyncLocalNotes && !isGuest && (
              <button
                className="user-btn"
                style={{ background: '#0F766E', borderColor: '#0F766E', color: '#FFFFFF' }}
                onClick={async () => {
                  setIsSyncing(true);
                  await onSyncLocalNotes();
                  setIsSyncing(false);
                }}
                disabled={isSyncing}
              >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                <span>{isSyncing ? 'Syncing...' : 'Sync Local Notes'}</span>
              </button>
            )}

            {onDeleteAllNotes && noteCount > 0 && (
              <button
                className="user-btn"
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  color: '#EF4444',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onClick={onDeleteAllNotes}
              >
                <Trash2 size={14} />
                <span>Delete All History</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ABOUT */}
      <div className="glass-card">
        <div className="card-title">
          <Info size={18} color="#0F766E" />
          <span style={{ color: 'var(--color-text-primary)' }}>About NoteCraft Desktop</span>
        </div>
        <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--color-text-primary)' }}>
          <div>
            <strong>Application:</strong> NoteCraft Desktop
          </div>
          <div>
            <strong>Version:</strong> 1.0.0
          </div>
          <div>
            <strong>Platform:</strong> Windows x64 (Windows 10/11)
          </div>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px', marginTop: '4px' }}>
            Copyright © 2026 NoteCraft. All rights reserved.
          </div>
        </div>
      </div>

      {/* ADVANCED DIAGNOSTICS (COLLAPSIBLE) */}
      <div className="glass-card" style={{ borderColor: showAdvanced ? 'var(--color-primary)' : 'var(--color-gray-200)' }}>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-text-primary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: 0,
            textAlign: 'left',
          }}
        >
          <div className="card-title" style={{ margin: 0 }}>
            <Cpu size={18} color="#6B7280" />
            <span style={{ color: 'var(--color-text-secondary)' }}>Advanced Diagnostics</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-secondary)', fontSize: '12px' }}>
            <span>{showAdvanced ? 'Hide Developer Diagnostics' : 'Show Developer Diagnostics'}</span>
            {showAdvanced ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
        </button>

        {showAdvanced && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-gray-200)' }}>
            {/* Backend Diagnostics */}
            <div>
              <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '13px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Server size={15} color="#0F766E" />
                <span>Backend Connection Diagnostics</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div><strong>Base URL:</strong> <code>{API_BASE_URL}</code></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span>Status: <strong>{healthStatus}</strong></span>
                  <button className="user-btn" onClick={verifyBackend} disabled={isChecking} style={{ padding: '4px 10px', fontSize: '11px' }}>
                    <RefreshCw size={12} className={isChecking ? 'animate-spin' : ''} />
                    <span>Test Connection</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Firebase Security Diagnostics */}
            <div>
              <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '13px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={15} color="#14B8A6" />
                <span>Firebase Authentication Diagnostics</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                <strong>Status:</strong>{' '}
                {isFirebaseConfigured ? (
                  <span style={{ color: '#14B8A6', fontWeight: 700 }}>Configured & Active</span>
                ) : (
                  <span style={{ color: '#EF4444', fontWeight: 700 }}>Not Configured</span>
                )}
              </div>
            </div>

            {/* Electron Engine Security & Diagnostics */}
            <div>
              <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '13px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Cpu size={15} color="#0F766E" />
                <span>Electron Process Security & Architecture</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                <div><strong>Context Isolation:</strong> <span style={{ color: '#14B8A6' }}>Enabled (true)</span></div>
                <div><strong>Node Integration:</strong> <span style={{ color: '#14B8A6' }}>Disabled (false)</span></div>
                <div><strong>IPC Preload API:</strong> <span style={{ color: '#14B8A6' }}>Active (window.electronAPI)</span></div>
                <div><strong>OS Platform:</strong> {sysInfo?.platform || 'win32'} ({sysInfo?.arch || 'x64'})</div>
                <div><strong>Electron Engine:</strong> v{sysInfo?.electronVersion || '30.5.1'}</div>
                <div><strong>Chromium Engine:</strong> v{sysInfo?.chromeVersion || '124.0'}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
