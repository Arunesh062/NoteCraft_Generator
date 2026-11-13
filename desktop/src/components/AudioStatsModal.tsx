import React from 'react';
import { X, CheckCircle2, Folder, Info } from 'lucide-react';
import { AudioStats } from '../types/electron';

interface AudioStatsModalProps {
  stats: AudioStats | null;
  onClose: () => void;
}

export const AudioStatsModal: React.FC<AudioStatsModalProps> = ({ stats, onClose }) => {
  if (!stats) return null;

  const fileSizeKb = Math.round((stats.fileSizeBytes / 1024) * 10) / 10;
  const fileSizeMb = (fileSizeKb / 1024).toFixed(2);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={20} color="#10b981" />
            <span className="modal-title">Phase 2 Local Audio Test Statistics</span>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="info-callout" style={{ borderColor: 'var(--emerald)', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}>
          <Info size={18} style={{ flexShrink: 0 }} />
          <div>
            <strong>Verified Local WebM/Opus File:</strong> Genuine WebM container recording with Opus audio encoding created locally. No audio was sent to external backends.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          <div className="stats-card">
            <span className="stats-title">Capture Duration</span>
            <span className="stats-val" style={{ fontSize: '18px' }}>{stats.durationSeconds}s</span>
          </div>

          <div className="stats-card">
            <span className="stats-title">Local File Size</span>
            <span className="stats-val" style={{ fontSize: '18px' }}>
              {fileSizeKb > 1024 ? `${fileSizeMb} MB` : `${fileSizeKb} KB`}
            </span>
          </div>

          <div className="stats-card">
            <span className="stats-title">Container Format</span>
            <span className="stats-val">{stats.container || 'WebM'}</span>
          </div>

          <div className="stats-card">
            <span className="stats-title">Audio Codec / MIME</span>
            <span className="stats-val" style={{ fontSize: '12px' }}>{stats.codec || 'Opus'} ({stats.mimeType || 'audio/webm;codecs=opus'})</span>
          </div>

          <div className="stats-card">
            <span className="stats-title">Microphone Chunks</span>
            <span className="stats-val">{stats.micChunksCount} chunks</span>
          </div>

          <div className="stats-card">
            <span className="stats-title">System Loopback Chunks</span>
            <span className="stats-val">{stats.systemChunksCount} chunks</span>
          </div>
        </div>

        {stats.filePath && (
          <div className="glass-card" style={{ padding: '14px', gap: '6px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Folder size={14} color="#06b6d4" /> Saved Temporary WebM File Location
            </div>
            <code style={{ fontSize: '12px', wordBreak: 'break-all', color: 'var(--text-muted)' }}>
              {stats.filePath}
            </code>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button
            className="user-btn"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))', color: '#fff' }}
            onClick={onClose}
          >
            <span>Close Statistics</span>
          </button>
        </div>
      </div>
    </div>
  );
};
