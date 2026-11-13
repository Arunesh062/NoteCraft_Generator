import React from 'react';
import { Users, GraduationCap, CheckCircle2 } from 'lucide-react';
import { MeetingMode, MeetingModeOption } from '../types/recording';

interface MeetingModeSelectorProps {
  activeMode: MeetingMode;
  onSelectMode: (mode: MeetingMode) => void;
  disabled?: boolean;
}

const MODES: MeetingModeOption[] = [
  {
    id: 'mom',
    title: 'Minutes of Meeting (MOM)',
    badge: 'MOM MODE',
    description: 'Generates executive summaries, key decisions, action items with assignees, and key discussion points.',
    icon: 'users',
    accentColor: '#0F766E',
    features: ['Action Items', 'Key Decisions', 'Attendee Summary', 'DOCX Export'],
  },
  {
    id: 'class_notes',
    title: 'Class / Webinar Notes',
    badge: 'LECTURE MODE',
    description: 'Creates structured educational notes, key concepts, study outlines, definitions, and topic breakdowns.',
    icon: 'graduation-cap',
    accentColor: '#0F766E',
    features: ['Key Concepts', 'Study Outline', 'Definitions', 'DOCX Export'],
  },
];

export const MeetingModeSelector: React.FC<MeetingModeSelectorProps> = ({
  activeMode,
  onSelectMode,
  disabled = false,
}) => {
  return (
    <div className="glass-card">
      <div>
        <div className="card-title">Meeting & Note-taking Template</div>
        <div className="card-desc">
          Select the AI structure template for note processing
        </div>
      </div>

      <div className="grid-2">
        {MODES.map((mode) => {
          const isActive = activeMode === mode.id;
          return (
            <div
              key={mode.id}
              className={`mode-card ${isActive ? 'active' : ''}`}
              onClick={() => !disabled && onSelectMode(mode.id)}
              style={{ opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
            >
              <div className="mode-header">
                <div className="mode-icon">
                  {mode.id === 'mom' ? <Users size={20} /> : <GraduationCap size={20} />}
                </div>
                <span className="mode-badge">{mode.badge}</span>
              </div>

              <div>
                <div className="mode-name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{mode.title}</span>
                  {isActive && <CheckCircle2 size={16} color="#0F766E" className="animate-spin-once" />}
                </div>
                <p className="card-desc" style={{ marginTop: '6px', fontSize: '12px' }}>
                  {mode.description}
                </p>
              </div>

              <div className="mode-list">
                {mode.features.map((feat) => (
                  <span key={feat} className="mode-pill">
                    {feat}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
