import type { PlaybackRate } from '../../types';

const RATES: PlaybackRate[] = [0.25, 0.5, 0.75, 1, 1.5, 2];

interface VideoControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: PlaybackRate;
  onTogglePlay: () => void;
  onStepFrame: (dir: 1 | -1) => void;
  onSeek: (time: number) => void;
  onSetRate: (rate: PlaybackRate) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
}

export function VideoControls({
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  onTogglePlay,
  onStepFrame,
  onSeek,
  onSetRate,
}: VideoControlsProps) {
  return (
    <div className="video-controls">
      <div className="controls-row">
        <button type="button" onClick={() => onStepFrame(-1)} title="이전 프레임">
          ⏮
        </button>
        <button type="button" onClick={onTogglePlay} className="play-btn">
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button type="button" onClick={() => onStepFrame(1)} title="다음 프레임">
          ⏭
        </button>
        <span className="time-display">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      <input
        type="range"
        className="seek-bar"
        min={0}
        max={duration || 0}
        step={0.001}
        value={currentTime}
        onChange={(e) => onSeek(Number(e.target.value))}
      />

      <div className="controls-row">
        <span className="label">속도</span>
        {RATES.map((rate) => (
          <button
            key={rate}
            type="button"
            className={playbackRate === rate ? 'active' : ''}
            onClick={() => onSetRate(rate)}
          >
            {rate}x
          </button>
        ))}
      </div>
    </div>
  );
}
