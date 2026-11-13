export interface SystemInfo {
  arch: string;
  platform: string;
  electronVersion: string;
  chromeVersion: string;
}

export interface AudioDeviceStatus {
  micAvailable: boolean;
  micDeviceName: string | null;
  systemAvailable: boolean;
  systemDeviceName: string | null;
  error?: string | null;
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

export interface AudioLevelData {
  micLevel: number;
  systemLevel: number;
  combinedLevel: number;
}

export interface ElectronAudioAPI {
  getStatus: () => Promise<AudioDeviceStatus>;
  getLoopbackSource: () => Promise<string | null>;
  saveTestRecording: (payload: {
    arrayBuffer: ArrayBuffer;
    durationSeconds: number;
    mimeType: string;
    micChunksCount: number;
    systemChunksCount: number;
    droppedFrames: number;
  }) => Promise<AudioStats>;
  logEvent: (level: string, message: string, details?: any) => Promise<boolean>;
  onStatusChange: (callback: (status: string) => void) => () => void;
}

export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
  getSystemInfo: () => Promise<SystemInfo>;
  audio?: ElectronAudioAPI;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
