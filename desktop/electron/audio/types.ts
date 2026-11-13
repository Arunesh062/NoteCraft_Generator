export type RecordingStatus = 'idle' | 'starting' | 'recording' | 'stopping' | 'completed' | 'error';

export interface AudioDeviceStatus {
  micAvailable: boolean;
  micDeviceName: string | null;
  systemAvailable: boolean;
  systemDeviceName: string | null;
  error?: string | null;
}

export interface AudioLevelData {
  micLevel: number; // 0.0 to 1.0
  systemLevel: number; // 0.0 to 1.0
  combinedLevel: number; // 0.0 to 1.0
}

export interface AudioStats {
  durationSeconds: number;
  container: string;
  codec: string;
  mimeType: string;
  micChunksCount: number;
  systemChunksCount: number;
  fileSizeBytes: number;
  filePath: string | null;
  droppedFrames: number;
  errorMessage: string | null;
}

export interface StartRecordingOptions {
  enableMic: boolean;
  enableSystem: boolean;
}
