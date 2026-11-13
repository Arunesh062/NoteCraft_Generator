import { desktopCapturer, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { AudioDeviceStatus, AudioStats } from './types';

export class WindowsAudioCapture {
  private tempDirectory: string;

  constructor() {
    this.tempDirectory = path.join(app.getPath('temp'), 'notecraft_audio_test');
    this.ensureTempDir();
    this.cleanupOldTempFiles();
  }

  private ensureTempDir() {
    try {
      if (!fs.existsSync(this.tempDirectory)) {
        fs.mkdirSync(this.tempDirectory, { recursive: true });
      }
    } catch (err) {
      console.error('[WindowsAudioCapture] Error creating temp directory:', err);
    }
  }

  private cleanupOldTempFiles() {
    try {
      if (fs.existsSync(this.tempDirectory)) {
        const files = fs.readdirSync(this.tempDirectory);
        const now = Date.now();
        files.forEach((file) => {
          if (file.startsWith('notecraft_rec_')) {
            const fp = path.join(this.tempDirectory, file);
            const stats = fs.statSync(fp);
            if (now - stats.mtimeMs > 3600000) {
              fs.unlinkSync(fp);
            }
          }
        });
      }
    } catch (err) {
      console.warn('[WindowsAudioCapture] Temp file cleanup notice:', err);
    }
  }

  public async getSystemLoopbackSource(): Promise<{ id: string; name: string } | null> {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'] });
      if (sources && sources.length > 0) {
        return {
          id: sources[0].id,
          name: sources[0].name || 'Windows Primary Display Output',
        };
      }
      return null;
    } catch (error) {
      console.error('[WindowsAudioCapture] Error getting system loopback source:', error);
      return null;
    }
  }

  public async detectDevices(): Promise<AudioDeviceStatus> {
    const loopbackSource = await this.getSystemLoopbackSource();

    return {
      micAvailable: true,
      micDeviceName: 'Default System Microphone',
      systemAvailable: Boolean(loopbackSource),
      systemDeviceName: loopbackSource ? loopbackSource.name : 'WASAPI Loopback Unavailable',
    };
  }

  public saveTestAudioFile(
    audioBuffer: Buffer,
    durationSeconds: number,
    mimeType: string,
    micChunksCount: number,
    systemChunksCount: number,
    droppedFrames: number
  ): AudioStats {
    this.ensureTempDir();
    const filename = `notecraft_rec_${Date.now()}.webm`;
    const filePath = path.join(this.tempDirectory, filename);

    try {
      // Save genuine raw WebM container & Opus audio bytes without WAV header wrapper
      fs.writeFileSync(filePath, audioBuffer);

      return {
        durationSeconds: Math.round(durationSeconds * 10) / 10,
        container: 'WebM',
        codec: 'Opus',
        mimeType: mimeType || 'audio/webm;codecs=opus',
        micChunksCount,
        systemChunksCount,
        fileSizeBytes: audioBuffer.length,
        filePath,
        droppedFrames,
        errorMessage: null,
      };
    } catch (error: any) {
      console.error('[WindowsAudioCapture] Failed to save test audio WebM file:', error);
      return {
        durationSeconds,
        container: 'WebM',
        codec: 'Opus',
        mimeType: mimeType || 'audio/webm;codecs=opus',
        micChunksCount,
        systemChunksCount,
        fileSizeBytes: 0,
        filePath: null,
        droppedFrames,
        errorMessage: error?.message || 'Failed to save audio to temp storage',
      };
    }
  }
}
