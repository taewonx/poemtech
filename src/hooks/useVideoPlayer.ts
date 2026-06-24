import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaybackRate } from '../types';

interface UseVideoPlayerOptions {
  fps?: number;
  onTimeUpdate?: (time: number) => void;
}

export function useVideoPlayer(options: UseVideoPlayerOptions = {}) {
  const { fps = 30, onTimeUpdate } = options;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(1);
  const frameDuration = 1 / fps;

  const play = useCallback(() => {
    videoRef.current?.play();
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    videoRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, play, pause]);

  const seek = useCallback((time: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(time, duration));
  }, [duration]);

  const stepFrame = useCallback((direction: 1 | -1) => {
    if (!videoRef.current) return;
    pause();
    const next = videoRef.current.currentTime + direction * frameDuration;
    videoRef.current.currentTime = Math.max(0, Math.min(next, duration));
  }, [pause, frameDuration, duration]);

  const setRate = useCallback((rate: PlaybackRate) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoaded = () => setDuration(video.duration || 0);
    const onTime = () => {
      setCurrentTime(video.currentTime);
      onTimeUpdate?.(video.currentTime);
    };
    const onEnded = () => setIsPlaying(false);

    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('ended', onEnded);
    return () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('ended', onEnded);
    };
  }, [onTimeUpdate]);

  return {
    videoRef,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    fps,
    play,
    pause,
    togglePlay,
    seek,
    stepFrame,
    setRate,
  };
}
