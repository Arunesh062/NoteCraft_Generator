import { contextBridge, ipcRenderer } from 'electron';

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
  audio: ElectronAudioAPI;
}

const electronAPI: ElectronAPI = {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  audio: {
    getStatus: () => ipcRenderer.invoke('audio:get-status'),
    getLoopbackSource: () => ipcRenderer.invoke('audio:get-loopback-source'),
    saveTestRecording: (payload) => ipcRenderer.invoke('audio:save-test-recording', payload),
    logEvent: (level, message, details) => ipcRenderer.invoke('audio:log-event', level, message, details),
    onStatusChange: (callback) => {
      const listener = (_event: any, status: string) => callback(status);
      ipcRenderer.on('audio:status-changed', listener);
      return () => {
        ipcRenderer.removeListener('audio:status-changed', listener);
      };
    },
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
