/**
 * Phase 3: Supabase 연동 스텁
 *
 * 실제 연동 시 @supabase/supabase-js 설치 후 환경변수 설정:
 * VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 *
 * 저장 대상: 관절 좌표 JSON만 (영상 X)
 */

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null;
}

/** Phase 3: Presigned URL로 스토리지에 직접 업로드 (서버 부하 없음) */
export async function uploadViaPresignedUrl(
  file: File,
  coachId: string,
): Promise<{ storagePath: string }> {
  void file;
  void coachId;
  throw new Error(
    'Phase 3: Supabase Storage를 설정한 후 사용할 수 있습니다. ' +
      'docs/PHASE3.md를 참고하세요.',
  );
}

/** Phase 3: TTL 기반 자동 삭제는 Supabase Edge Function 또는 Cron으로 구현 */
export const VIDEO_TTL_DAYS = 7;
