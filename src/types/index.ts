export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  type: 'point' | 'line' | 'path';
  points: Point[];
  color: string;
}

export interface DrawingState {
  strokes: Stroke[];
  currentStroke: Stroke | null;
}

export type DrawMode = 'point' | 'line' | 'path' | 'scrub';

export interface PoseKeypoint {
  x: number;
  y: number;
  z?: number;
  score?: number;
  name?: string;
}

export interface PoseFrame {
  frameIndex: number;
  timestamp: number;
  keypoints: PoseKeypoint[];
}

export interface PoseAnalysisResult {
  frames: PoseFrame[];
  fps: number;
  duration: number;
  analyzedAt: string;
}

export interface SavedAnalysis {
  id: string;
  name: string;
  exercise: string;
  result: PoseAnalysisResult;
  createdAt: string;
}

export type PlaybackRate = 0.25 | 0.5 | 0.75 | 1 | 1.5 | 2;
