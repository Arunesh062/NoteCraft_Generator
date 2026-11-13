export type MeetingMode = 'mom' | 'class_notes';

export type RecordingState =
  | 'idle'
  | 'starting'
  | 'recording'
  | 'stopping'
  | 'uploading'
  | 'processing'
  | 'completed'
  | 'error';

export interface MeetingModeOption {
  id: MeetingMode;
  title: string;
  badge: string;
  description: string;
  icon: string;
  accentColor: string;
  features: string[];
}
