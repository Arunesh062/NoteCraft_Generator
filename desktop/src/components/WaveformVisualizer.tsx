import React, { useEffect, useRef } from 'react';
import { RecordingState } from '../types/recording';
import { AudioLevelData } from '../types/electron';

interface WaveformVisualizerProps {
  recordingState: RecordingState;
  audioLevels?: AudioLevelData;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  recordingState,
  audioLevels = { micLevel: 0, systemLevel: 0, combinedLevel: 0 },
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isRecording = recordingState === 'recording';
  const levelsRef = useRef(audioLevels);

  useEffect(() => {
    levelsRef.current = audioLevels;
  }, [audioLevels]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let phase = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      const barCount = 48;
      const barWidth = 4;
      const gap = (width - barCount * barWidth) / (barCount + 1);

      phase += 0.08;

      const { micLevel, systemLevel, combinedLevel } = levelsRef.current;

      for (let i = 0; i < barCount; i++) {
        const x = gap + i * (barWidth + gap);
        let barHeight = 4;

        if (isRecording) {
          // Modulate height based strictly on REAL audio capture volume levels
          const levelFactor = combinedLevel > 0.02 ? combinedLevel : 0.05;
          const isMicHalf = i < barCount / 2;
          const specificLevel = isMicHalf ? micLevel : systemLevel;
          const activeFactor = specificLevel > 0.02 ? specificLevel : levelFactor;

          const harmonic = Math.sin(phase + i * 0.3) * 0.3 + 0.7;
          barHeight = Math.max(6, activeFactor * height * 0.85 * harmonic + Math.random() * 3);
        } else {
          // Flat ambient static baseline when idle
          barHeight = 4;
        }

        const gradient = ctx.createLinearGradient(0, centerY - barHeight / 2, 0, centerY + barHeight / 2);
        if (isRecording) {
          if (combinedLevel > 0.6) {
            gradient.addColorStop(0, '#EF4444'); // Red high volume alert peak
            gradient.addColorStop(1, '#DC2626');
          } else {
            gradient.addColorStop(0, '#0F766E'); // NoteCraft Primary Teal
            gradient.addColorStop(0.5, '#2DD4BF'); // Secondary Bright Teal
            gradient.addColorStop(1, '#ACD9CC'); // Accent Soft Mint
          }
        } else {
          gradient.addColorStop(0, 'rgba(15, 118, 110, 0.25)');
          gradient.addColorStop(1, 'rgba(45, 212, 191, 0.12)');
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, centerY - barHeight / 2, barWidth, barHeight, 2);
        ctx.fill();
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isRecording]);

  return (
    <div className="waveform-box">
      <canvas
        ref={canvasRef}
        width={800}
        height={80}
        className="waveform-canvas"
      />
    </div>
  );
};
