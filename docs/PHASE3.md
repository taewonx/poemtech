# Phase 3: B2B/C2C 플랫폼화 가이드

## 개요

코치/인플루언서가 유저에게 유료 폼 피드백을 제공하는 모델입니다.
영상 저장이 불가피하지만, B2B 방식으로 리스크를 최소화합니다.

## 아키텍처

```
[유저 브라우저] ──Presigned URL──▶ [Supabase Storage]
       │                                    │
       │ 결제                               │ CDN (Cloudflare)
       ▼                                    ▼
[Stripe/PortOne]                    [코치 대시보드]
       │
       ▼
[Webhook → Slack/이메일 알림]
```

## 1. Presigned URL 직접 업로드

서버를 거치지 않고 브라우저에서 스토리지로 직접 업로드합니다.

```typescript
// Supabase Edge Function 예시
const { data, error } = await supabase.storage
  .from('form-videos')
  .createSignedUploadUrl(`${coachId}/${submissionId}.mp4`);

// 클라이언트에서 직접 PUT
await fetch(data.signedUrl, {
  method: 'PUT',
  body: videoFile,
  headers: { 'Content-Type': videoFile.type },
});
```

## 2. TTL 자동 삭제 (7일)

Supabase Edge Function + pg_cron:

```sql
-- 매일 실행: 피드백 완료 후 7일 지난 영상 삭제
DELETE FROM storage.objects
WHERE bucket_id = 'form-videos'
  AND created_at < NOW() - INTERVAL '7 days'
  AND metadata->>'feedback_completed' = 'true';
```

## 3. 환경 변수

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_STRIPE_PUBLIC_KEY=pk_...
```

## 4. 위젯 임베드

```html
<script src="https://formtech.app/widget.js"></script>
<div id="formtech-widget" data-coach-id="coach_123" data-price="15000"></div>
```

## 5. CS 자동화

- 결제 실패 → Stripe Webhook → Slack 알림 + 유저 자동 이메일
- 업로드 실패 → Storage 이벤트 → 재시도 링크 이메일

## 비용 예측 (1인 창업가 기준)

| 항목 | 월 예상 비용 |
|------|-------------|
| Vercel (정적 호스팅) | $0 |
| Supabase Free Tier | $0 |
| Storage (100GB, TTL 7일) | ~$2 |
| CDN (Cloudflare Free) | $0 |
| Stripe 수수료 | 거래당 3.6% |

**핵심**: 영상은 TTL로 자동 삭제, JSON 좌표만 영구 저장.
