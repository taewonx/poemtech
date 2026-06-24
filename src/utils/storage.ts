import type { SavedAnalysis, Stroke } from '../types';

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
  const list = loadAnalyses();
  list.unshift(analysis);
  localStorage.setItem(ANALYSES_KEY, JSON.stringify(list.slice(0, 20)));
}

export function exportStrokes(strokes: Stroke[]): string {
  return JSON.stringify(strokes, null, 2);
}

export function importStrokes(json: string): Stroke[] {
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) throw new Error('Invalid stroke data');
  return parsed;
}
