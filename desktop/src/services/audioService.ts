import { AudioDeviceStatus, AudioLevelData, AudioStats } from '../types/electron';

export interface StartCaptureParams {
  enableMic: boolean;
  enableSystem: boolean;
  onLevels?: (levels: AudioLevelData) => void;
  onError?: (errMessage: string) => void;
  onChunkReady?: (chunk: { audioBlob: Blob; sessionId: string; chunkIndex: number }) => void;
}

export class AudioService {
  private micStream: MediaStream | null = null;
  private systemStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private systemAnalyser: AnalyserNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;

  private recordedChunks: Blob[] = [];
  private currentSliceChunks: Blob[] = [];
  private levelCheckInterval: NodeJS.Timeout | null = null;
  private chunkEmitInterval: NodeJS.Timeout | null = null;

  private currentSessionId: string = '';
  private currentChunkIndex: number = 0;
  private micChunksCount = 0;
  private systemChunksCount = 0;
  private droppedFrames = 0;
  private startTime = 0;
  private onChunkReadyCallback?: (chunk: { audioBlob: Blob; sessionId: string; chunkIndex: number }) => void;

  public async getDeviceStatus(): Promise<AudioDeviceStatus> {
    try {
      let micAvailable = false;
      let micDeviceName: string | null = null;

      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter((d) => d.kind === 'audioinput');
        if (audioInputs.length > 0) {
          micAvailable = true;
          micDeviceName = audioInputs[0].label || 'Default Windows Microphone';
        }
      }

      let systemAvailable = false;
      let systemDeviceName: string | null = null;

      if (window.electronAPI?.audio?.getLoopbackSource) {
        const loopbackId = await window.electronAPI.audio.getLoopbackSource();
        if (loopbackId) {
          systemAvailable = true;
          systemDeviceName = 'Windows WASAPI System Audio (Output Loopback)';
        }
      }

      return {
        micAvailable,
        micDeviceName,
        systemAvailable,
        systemDeviceName,
      };
    } catch (err: any) {
      return {
        micAvailable: false,
        micDeviceName: null,
        systemAvailable: false,
        systemDeviceName: null,
        error: err?.message || 'Device detection error',
      };
    }
  }

  public setMicMuted(muted: boolean): void {
    if (this.micStream) {
      this.micStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  public isMicMuted(): boolean {
    if (!this.micStream) return true;
    const tracks = this.micStream.getAudioTracks();
    if (tracks.length === 0) return true;
    return !tracks[0].enabled;
  }

  public getSessionId(): string {
    return this.currentSessionId;
  }

  public async startCapture(params: StartCaptureParams): Promise<boolean> {
    await this.stopCapture();
    this.recordedChunks = [];
    this.currentSliceChunks = [];
    this.micChunksCount = 0;
    this.systemChunksCount = 0;
    this.droppedFrames = 0;
    this.startTime = Date.now();
    this.currentChunkIndex = 0;
    this.currentSessionId = `rec_dt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.onChunkReadyCallback = params.onChunkReady;

    try {
      const audioTracks: MediaStreamTrack[] = [];

      // 1. Capture Microphone Audio
      if (params.enableMic) {
        try {
          this.micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            },
          });
          const tracks = this.micStream.getAudioTracks();
          if (tracks.length > 0) {
            audioTracks.push(tracks[0]);
          }
        } catch (micErr: any) {
          console.warn('[AudioService] Microphone capture error:', micErr);
          if (window.electronAPI?.audio?.logEvent) {
            window.electronAPI.audio.logEvent('warn', 'Microphone capture error', micErr?.message);
          }
          if (!params.enableSystem) {
            throw new Error(`Microphone access error: ${micErr?.message || 'Permission denied'}`);
          }
        }
      }

      // 2. Capture Windows System Audio Loopback
      if (params.enableSystem && window.electronAPI?.audio?.getLoopbackSource) {
        try {
          const loopbackId = await window.electronAPI.audio.getLoopbackSource();
          if (loopbackId) {
            this.systemStream = await navigator.mediaDevices.getUserMedia({
              audio: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: loopbackId,
                },
              } as any,
              video: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: loopbackId,
                },
              } as any,
            });
            // Immediately stop unused video tracks
            this.systemStream.getVideoTracks().forEach((track) => track.stop());
            const sysTracks = this.systemStream.getAudioTracks();
            if (sysTracks.length > 0) {
              audioTracks.push(sysTracks[0]);
            }
          }
        } catch (sysErr: any) {
          console.warn('[AudioService] System audio loopback capture error:', sysErr);
          if (window.electronAPI?.audio?.logEvent) {
            window.electronAPI.audio.logEvent('warn', 'System audio loopback error', sysErr?.message);
          }
          if (audioTracks.length === 0) {
            throw new Error(`System audio loopback error: ${sysErr?.message || 'Source unavailable'}`);
          }
        }
      }

      if (audioTracks.length === 0) {
        throw new Error('No audio input sources could be opened for recording.');
      }

      // 3. Audio Context & Real-time Analyser Nodes
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      if (this.micStream) {
        const micSource = this.audioContext.createMediaStreamSource(this.micStream);
        this.micAnalyser = this.audioContext.createAnalyser();
        this.micAnalyser.fftSize = 256;
        micSource.connect(this.micAnalyser);
      }

      if (this.systemStream) {
        const sysSource = this.audioContext.createMediaStreamSource(this.systemStream);
        this.systemAnalyser = this.audioContext.createAnalyser();
        this.systemAnalyser.fftSize = 256;
        sysSource.connect(this.systemAnalyser);
      }

      // Monitor live audio levels
      if (params.onLevels) {
        const micData = new Uint8Array(128);
        const sysData = new Uint8Array(128);

        this.levelCheckInterval = setInterval(() => {
          let micLevel = 0;
          let systemLevel = 0;

          if (this.micAnalyser) {
            this.micAnalyser.getByteFrequencyData(micData);
            let sum = 0;
            for (let i = 0; i < micData.length; i++) sum += micData[i];
            micLevel = Math.min(1.0, (sum / (micData.length * 255)) * 2.5);
          }

          if (this.systemAnalyser) {
            this.systemAnalyser.getByteFrequencyData(sysData);
            let sum = 0;
            for (let i = 0; i < sysData.length; i++) sum += sysData[i];
            systemLevel = Math.min(1.0, (sum / (sysData.length * 255)) * 2.5);
          }

          const combinedLevel = Math.max(micLevel, systemLevel);
          params.onLevels!({ micLevel, systemLevel, combinedLevel });
        }, 50);
      }

      // 4. MediaRecorder for actual audio capture
      const combinedStream = new MediaStream(audioTracks);
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      this.mediaRecorder = new MediaRecorder(combinedStream, { mimeType });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
          this.currentSliceChunks.push(event.data);
          if (this.micStream) this.micChunksCount++;
          if (this.systemStream) this.systemChunksCount++;
        } else {
          this.droppedFrames++;
        }
      };

      this.mediaRecorder.onerror = (evt: any) => {
        console.error('[AudioService] MediaRecorder error:', evt);
        if (params.onError) {
          params.onError(evt?.error?.message || 'MediaRecorder error occurred');
        }
      };

      this.mediaRecorder.start(250); // Emit audio slice every 250ms

      // 5. Emit periodic 30-second audio chunks for backend upload
      this.chunkEmitInterval = setInterval(() => {
        this.emitCurrentChunkSlice();
      }, 30000); // 30 seconds

      return true;
    } catch (err: any) {
      console.error('[AudioService] startCapture failed:', err);
      if (params.onError) {
        params.onError(err?.message || 'Failed to start audio recording');
      }
      await this.stopCapture();
      return false;
    }
  }

  private emitCurrentChunkSlice() {
    if (this.currentSliceChunks.length === 0 || !this.onChunkReadyCallback) return;

    const mimeType = this.mediaRecorder?.mimeType || 'audio/webm;codecs=opus';
    const audioBlob = new Blob(this.currentSliceChunks, { type: mimeType });
    this.currentSliceChunks = [];

    const chunkIndex = this.currentChunkIndex++;
    const sessionId = this.currentSessionId;

    console.log(`[AudioService] Emitting 30s audio chunk #${chunkIndex} (${audioBlob.size} bytes)`);
    this.onChunkReadyCallback({ audioBlob, sessionId, chunkIndex });
  }

  public async stopCapture(): Promise<AudioStats | null> {
    try {
      if (this.levelCheckInterval) {
        clearInterval(this.levelCheckInterval);
        this.levelCheckInterval = null;
      }

      if (this.chunkEmitInterval) {
        clearInterval(this.chunkEmitInterval);
        this.chunkEmitInterval = null;
      }

      const durationSeconds = this.startTime > 0 ? (Date.now() - this.startTime) / 1000 : 0;

      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        try {
          this.mediaRecorder.stop();
        } catch (recErr) {
          console.warn('[AudioService] MediaRecorder stop warning:', recErr);
        }
      }

      // Emit remaining audio as the final chunk
      this.emitCurrentChunkSlice();

      if (this.micStream) {
        try {
          this.micStream.getTracks().forEach((track) => track.stop());
        } catch (trackErr) {
          console.warn('[AudioService] micStream stop error:', trackErr);
        }
        this.micStream = null;
      }

      if (this.systemStream) {
        try {
          this.systemStream.getTracks().forEach((track) => track.stop());
        } catch (trackErr) {
          console.warn('[AudioService] systemStream stop error:', trackErr);
        }
        this.systemStream = null;
      }

      if (this.audioContext) {
        try {
          await this.audioContext.close();
        } catch (ctxErr) {
          // ignore closed context warnings
        }
        this.audioContext = null;
      }

      this.micAnalyser = null;
      this.systemAnalyser = null;

      if (this.recordedChunks.length === 0) {
        return null;
      }

      const mimeType = this.mediaRecorder?.mimeType || 'audio/webm;codecs=opus';
      const blob = new Blob(this.recordedChunks, { type: mimeType });
      const arrayBuffer = await blob.arrayBuffer();

      if (window.electronAPI?.audio?.saveTestRecording) {
        return await window.electronAPI.audio.saveTestRecording({
          arrayBuffer,
          durationSeconds,
          mimeType,
          micChunksCount: this.micChunksCount,
          systemChunksCount: this.systemChunksCount,
          droppedFrames: this.droppedFrames,
        });
      }

      return {
        durationSeconds,
        container: 'WebM',
        codec: 'Opus',
        mimeType,
        micChunksCount: this.micChunksCount,
        systemChunksCount: this.systemChunksCount,
        fileSizeBytes: blob.size,
        filePath: null,
        droppedFrames: this.droppedFrames,
        errorMessage: null,
      };
    } catch (err: any) {
      console.warn('[AudioService] Exception during stopCapture cleanup:', err);
      return null;
    }
  }

  public async destroy(): Promise<void> {
    await this.stopCapture();
  }
}

export const audioService = new AudioService();
