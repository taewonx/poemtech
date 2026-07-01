import type { SavedAnalysis } from '../types';

const ANALYSES_KEY = 'formtech_analyses';
const SETTINGS_KEY = 'formtech_settings';

export interface AppSettings {
  defaultFps: number;
  drawColor: string;
  playbackRate: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultFps: 30,
  drawColor: '#00ff88',
  playbackRate: 1,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Partial<AppSettings>) {
  const current = loadSettings();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...settings }));
}

export function loadAnalyses(): SavedAnalysis[] {
  try {
    const raw = localStorage.getItem(ANALYSES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAnalysis(analysis: SavedAnalysis) {
  try {
    let list = loadAnalyses();
    list.unshift(analysis);
    
    // 로컬 스토리지 용량 제한 방지: 5개까지만 저장
    list = list.slice(0, 5);
    
    try {
      localStorage.setItem(ANALYSES_KEY, JSON.stringify(list));
    } catch {
      // 용량 초과 에러 (QuotaExceededError) 발생 시 가장 오래된 것부터 삭제하며 재시도
      while (list.length > 1) {
        list.pop();
        try {
          localStorage.setItem(ANALYSES_KEY, JSON.stringify(list));
          break;
        } catch {
          continue;
        }
      }
    }
  } catch (error) {
    console.warn('분석 결과 저장 실패:', error);
  }
}


