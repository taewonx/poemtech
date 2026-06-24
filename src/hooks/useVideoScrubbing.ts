import { useState, useRef } from 'react';

interface UseVideoScrubbingProps {
  duration: number;
  currentTime: number;
  seek: (time: number) => void;
  togglePlay: () => void;
}

export function useVideoScrubbing({ duration, currentTime, seek, togglePlay }: UseVideoScrubbingProps) {
  const [isScrubbing, setIsScrubbing] = useState(false);
  const scrubStartRef = useRef<{ x: number; time: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (!duration) return;
    setIsScrubbing(true);
    scrubStartRef.current = { x: e.clientX, time: currentTime };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!isScrubbing || !scrubStartRef.current || !duration) return;
    const deltaX = e.clientX - scrubStartRef.current.x;
    const containerWidth = e.currentTarget.clientWidth || 500;
    // 화면의 80%를 드래그하면 영상 전체 길이를 탐색할 수 있도록 민감도 설정
    const timeDelta = (deltaX / (containerWidth * 0.8)) * duration;
    seek(scrubStartRef.current.time + timeDelta);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLElement>) => {
    setIsScrubbing(false);
    if (scrubStartRef.current) {
      const deltaX = Math.abs(e.clientX - scrubStartRef.current.x);
      if (deltaX < 5) {
        togglePlay();
      }
    }
    scrubStartRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return {
    isScrubbing,
    scrubHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
    }
  };
}
