import { ipcMain, BrowserWindow } from 'electron';
import { WindowsAudioCapture } from './WindowsAudioCapture';
import { AudioDeviceStatus, AudioStats, RecordingStatus } from './types';

export class AudioCaptureManager {
  private windowsAudio: WindowsAudioCapture;
  private currentStatus: RecordingStatus = 'idle';

  constructor() {
    this.windowsAudio = new WindowsAudioCapture();
  }

  public registerIpcHandlers() {
    ipcMain.handle('audio:get-status', async (): Promise<AudioDeviceStatus> => {
      return await this.windowsAudio.detectDevices();
    });

    ipcMain.handle('audio:get-loopback-source', async () => {
      const source = await this.windowsAudio.getSystemLoopbackSource();
      return source ? source.id : null;
    });

    ipcMain.handle(
      'audio:save-test-recording',
      async (
        _event,
        payload: {
          arrayBuffer: ArrayBuffer;
          durationSeconds: number;
          mimeType: string;
          micChunksCount: number;
          systemChunksCount: number;
          droppedFrames: number;
        }
      ): Promise<AudioStats> => {
        const buffer = Buffer.from(payload.arrayBuffer);
        return this.windowsAudio.saveTestAudioFile(
          buffer,
          payload.durationSeconds,
          payload.mimeType,
          payload.micChunksCount,
          payload.systemChunksCount,
          payload.droppedFrames
        );
      }
    );

    ipcMain.handle('audio:log-event', (_event, level: string, message: string, details?: any) => {
      console.log(`[AudioCaptureManager][${level.toUpperCase()}] ${message}`, details || '');
      return true;
    });
  }

  public setStatus(status: RecordingStatus) {
    this.currentStatus = status;
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((win) => {
      win.webContents.send('audio:status-changed', status);
    });
  }

  public getStatus(): RecordingStatus {
    return this.currentStatus;
  }
}
