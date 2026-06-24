# 폼테크 (FormTech)

> **"비디오는 무겁고, 코드는 가볍다"**

1인 창업가를 위한 클라이언트 중심 운동 폼 분석 도구입니다.
모든 영상 처리와 AI 추론은 **유저의 브라우저**에서 수행되며, 서버 비용은 최소화됩니다.

## 핵심 철학

| 원칙 | 구현 |
|------|------|
| 영상은 서버에 안 올린다 | Blob URL, 브라우저 메모리만 사용 |
| AI는 클라이언트에서 돌린다 | TensorFlow.js + MediaPipe BlazePose |
| 저장은 JSON만 | 관절 좌표 (KB 단위), 영상 X |
| 배포는 정적 호스팅 | Vercel/Netlify, 서버 불필요 |

## Phase별 기능

### Phase 1 — MVP (구현 완료)
- `/analyzer` — 영상 업로드 + 프레임 단위 이동 + 슬로우 모션
- `/compare` — 내 영상 vs 전문가 영상 나란히 비교
- Canvas API — 관절 포인트, 바벨 궤적 직접 그리기

### Phase 2 — Vision AI (구현 완료)
- `/pose` — MoveNet으로 관절 17개 자동 추출
- 스켈레톤 시각화 + 팔꿈치/무릎/고관절 각도 표시
- 분석 결과 JSON → localStorage 저장

### Phase 3 — B2B 플랫폼 (스텁)
- `src/widget/FormCheckWidget.tsx` — 코치 임베드 위젯
- `src/services/supabase.ts` — Presigned URL 업로드 스텁
- `docs/PHASE3.md` — 상세 아키텍처 가이드

## 시작하기

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:5173 접속

## 배포

```bash
npm run build
# Vercel
npx vercel

# Netlify
npx netlify deploy --prod --dir=dist
```

## 프로젝트 구조

```
src/
├── components/
│   ├── VideoPlayer/     # 프레임 이동, 슬로우 모션
│   ├── CanvasOverlay/   # 바패스/관절 그리기
│   ├── ComparisonView/  # 전문가 영상 비교
│   └── PoseAnalyzer/    # BlazePose AI 분석
├── hooks/
│   ├── useVideoPlayer.ts
│   ├── useCanvasDrawing.ts
│   └── useBlobUrl.ts
├── services/
│   ├── poseDetection.ts # TensorFlow.js BlazePose
│   └── supabase.ts      # Phase 3 스텁
├── pages/
└── widget/              # Phase 3 임베드 위젯
```

## 기술 스택

- **Frontend**: React 19 + TypeScript + Vite
- **AI**: @tensorflow/tfjs + MoveNet (클라이언트 추론)
- **라우팅**: react-router-dom
- **배포**: Vercel / Netlify (정적)

## 라이선스

MIT
