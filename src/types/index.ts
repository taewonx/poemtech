

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

/** 개별 운동 랩(반복) 기록 */
export interface RepRecord {
  id: string;
  repIndex: number;
  startTime?: number;
  endTime?: number;
  duration: number;
  maxDepth: string;
  isGood: boolean;
  errorType: string[];
}

/** 세션(세트) 요약 기록 — localStorage에 저장 */
export interface SavedSession {
  id: string;
  date: string;
  exercise: 'squat' | 'deadlift';
  totalReps: number;
  goodReps: number;
  successRate: number;
  notes: string;
}

/** 랩 카운터 상태 머신 페이즈 */
export type RepPhase = 'none' | 'descending' | 'bottom' | 'ascending';

/** 스쿼트 깊이 단계 */
export type SquatDepth = 'standing' | 'partial' | 'parallel' | 'deep';
