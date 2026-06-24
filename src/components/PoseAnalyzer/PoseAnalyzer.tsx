import { useCallback, useEffect, useRef, useState } from 'react';
import {
  analyzeSquatFrame,
  analyzeDeadliftFrame,
  getActiveSideKeypoints,
} from '../../utils/angles';
import type { PostureAnalysisResult } from '../../utils/angles';
import { saveAnalysis } from '../../utils/storage';
import {
  detectPoseInVideo,
  findClosestFrame,
  initPoseDetector,
} from '../../services/poseDetection';
import type { PoseFrame, PoseKeypoint, PoseAnalysisResult as TFAnalysisResult } from '../../types';


import { useBlobUrl } from '../../hooks/useBlobUrl';
import { useVideoPlayer } from '../../hooks/useVideoPlayer';
import { useVideoScrubbing } from '../../hooks/useVideoScrubbing';
import { useCanvasDrawing } from '../../hooks/useCanvasDrawing';
import { VideoControls } from '../VideoPlayer/VideoControls';
import { CanvasOverlay } from '../CanvasOverlay/CanvasOverlay';
import type { DrawMode } from '../../types';

// TTS 코칭 보이스 재생 함수
function speak(text: string, enabled: boolean) {
  if (!enabled || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel(); // 진행 중인 음성 취소
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 1.1; // 살짝 빠른 한국어 코칭
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.error('Speech synthesis error:', e);
  }
}

interface SavedSession {
  id: string;
  date: string;
  exercise: 'squat' | 'deadlift';
  totalReps: number;
  goodReps: number;
  successRate: number;
  notes: string;
}

export function PoseAnalyzer() {
  const { blobUrl, fileName, loadFile, clear } = useBlobUrl();
  const {
    videoRef,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    togglePlay,
    seek,
    stepFrame,
    setRate,
  } = useVideoPlayer();

  const { isScrubbing, scrubHandlers } = useVideoScrubbing({
    duration,
    currentTime,
    seek,
    togglePlay,
  });

  const {
    strokes,
    drawMode,
    color,
    setDrawMode,
    setColor,
    startStroke,
    continueStroke,
    endStroke,
    undo,
    clear: clearDrawing,
  } = useCanvasDrawing();

  // 탭 및 설정 상태
  const [activeTab, setActiveTab] = useState<'webcam' | 'video'>('webcam');
  const [exercise, setExercise] = useState<'squat' | 'deadlift'>('squat');
  const [modelReady, setModelReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // 촬영 준비 가이드 상태
  const [showPrepGuide, setShowPrepGuide] = useState(true);
  const [guideAngle, setGuideAngle] = useState(false);
  const [guideFullBody, setGuideFullBody] = useState(false);
  const [guideClothing, setGuideClothing] = useState(false);
  const [guideConsent, setGuideConsent] = useState(false);

  // 웹캠 제어 상태
  const [webcamActive, setWebcamActive] = useState(false);
  const webcamActiveRef = useRef(false);
  const [liveAnalysis, setLiveAnalysis] = useState<PostureAnalysisResult | null>(null);
  const [webcamReps, setWebcamReps] = useState<Array<{ id: string; repIndex: number; duration: number; maxDepth: string; isGood: boolean; errorType: string[] }>>([]);
  const [webcamRepCount, setWebcamRepCount] = useState(0);
  const [webcamGoodReps, setWebcamGoodReps] = useState(0);

  // 비디오 파일 제어 상태
  const [frames, setFrames] = useState<PoseFrame[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoReps, setVideoReps] = useState<Array<{ id: string; repIndex: number; duration: number; maxDepth: string; isGood: boolean; errorType: string[] }>>([]);

  // 세션 저장 및 히스토리 관리 (localStorage 초기화)
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>(() => {
    try {
      const raw = localStorage.getItem('poemtech_session_history');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error(e);
      return [];
    }
  });
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // 비디오 해상도 측정 (그리기 용도)
  const [dimensions, setDimensions] = useState({ width: 640, height: 360 });

  // DOM 및 애니메이션 참조
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const isProcessingFrame = useRef(false);
  const lastPoseFrame = useRef<{ keypoints: PoseKeypoint[]; result: PostureAnalysisResult } | null>(null);

  // 실시간 랩 카운터 상태 관리 레퍼런스
  const repState = useRef<'none' | 'descending' | 'bottom' | 'ascending'>('none');
  const repWinkDetected = useRef(false);
  const repBackRounding = useRef(false);
  const repMaxDepth = useRef<'standing' | 'partial' | 'parallel' | 'deep'>('standing');
  const repStartTime = useRef(0);
  const repErrorTypes = useRef<Set<string>>(new Set());

  // 비디오 해상도 추적
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateSize = () => {
      const rect = video.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({
          width: rect.width,
          height: rect.height,
        });
      }
    };

    video.addEventListener('loadedmetadata', updateSize);
    window.addEventListener('resize', updateSize);
    // 비디오 URL이 변경될 때마다 크기 다시 체크
    const timer = setTimeout(updateSize, 100);

    return () => {
      video.removeEventListener('loadedmetadata', updateSize);
      window.removeEventListener('resize', updateSize);
      clearTimeout(timer);
    };
  }, [blobUrl, videoRef]);

  // 모델 로드
  useEffect(() => {
    initPoseDetector()
      .then(() => setModelReady(true))
      .catch(() => setError('AI 모델 로딩에 실패했습니다.'));
  }, []);

  // 탭 및 종목 변경 핸들러
  const handleTabChange = (tab: 'webcam' | 'video') => {
    setActiveTab(tab);
    stopWebcam();
    setLiveAnalysis(null);
    setWebcamReps([]);
    setWebcamRepCount(0);
    setWebcamGoodReps(0);
  };

  const handleExerciseChange = (newEx: 'squat' | 'deadlift') => {
    setExercise(newEx);
    resetRepState();
    setWebcamReps([]);
    setWebcamRepCount(0);
    setWebcamGoodReps(0);
    setVideoReps([]);
    if (frames.length > 0) {
      const scanned = scanVideoReps(frames, newEx);
      setVideoReps(scanned);
    }
  };

  // 랩 카운터 상태 초기화
  function resetRepState() {
    repState.current = 'none';
    repWinkDetected.current = false;
    repBackRounding.current = false;
    repMaxDepth.current = 'standing';
    repStartTime.current = 0;
    repErrorTypes.current.clear();
  };

  // 파생 상태 (현재 프레임 분석 결과)
  const currentVideoFrame = (activeTab === 'video' && frames.length > 0) ? findClosestFrame(frames, currentTime) : null;
  const currentFrameAnalysis = currentVideoFrame 
    ? (exercise === 'squat' ? analyzeSquatFrame(currentVideoFrame.keypoints) : analyzeDeadliftFrame(currentVideoFrame.keypoints))
    : null;

  // 스켈레톤 및 랜드마크 그리기 함수
  const drawSkeletonOnCanvas = (
    ctx: CanvasRenderingContext2D,
    keypoints: PoseKeypoint[],
    result: PostureAnalysisResult
  ) => {
    const sideInfo = getActiveSideKeypoints(keypoints);
    const { shoulder, hip, knee, ankle } = sideInfo;

    if (!shoulder || !hip || !knee || !ankle) return;

    // 감지 상태별 스켈레톤 색상
    let strokeColor = '#00ff88'; // Good (그린)
    if (result.status === 'warning') {
      strokeColor = '#ffb300'; // Warning (옐로우)
    } else if (result.status === 'danger') {
      strokeColor = '#ff4757'; // Danger (레드)
    }

    // 라인 설정
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 뼈대 그리기
    ctx.beginPath();
    ctx.moveTo(shoulder.x, shoulder.y);
    ctx.lineTo(hip.x, hip.y);
    ctx.lineTo(knee.x, knee.y);
    ctx.lineTo(ankle.x, ankle.y);
    ctx.stroke();

    // 조인트 원형 그리기
    const drawJointCircle = (kp: PoseKeypoint) => {
      ctx.fillStyle = '#ff6b35';
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };

    drawJointCircle(shoulder);
    drawJointCircle(hip);
    drawJointCircle(knee);
    drawJointCircle(ankle);

    // 위험 부하 발생 시 추가적인 빨간색 펄스 이펙트 생성
    if (result.status === 'danger') {
      const pulse = 14 + Math.sin(Date.now() / 80) * 4;
      ctx.strokeStyle = 'rgba(255, 71, 87, 0.7)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      if (result.hasButtWink) {
        ctx.arc(hip.x, hip.y, pulse, 0, Math.PI * 2);
      } else if (result.hasBackRounding) {
        const midX = (shoulder.x + hip.x) / 2;
        const midY = (shoulder.y + hip.y) / 2;
        ctx.arc(midX, midY, pulse, 0, Math.PI * 2);
      }
      ctx.stroke();
    }

    // 각도 텍스트 그리기
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px sans-serif';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 4;

    ctx.fillText(`${result.kneeAngle}°`, knee.x + 12, knee.y);
    ctx.fillText(`${result.hipAngle}°`, hip.x + 12, hip.y);
    ctx.fillText(`등 각도: ${result.backAngle}°`, shoulder.x - 10, shoulder.y - 15);

    ctx.shadowBlur = 0; // 초기화
  };

  // 비디오 파일 프레임 변경 시 실시간 각도 시각화
  useEffect(() => {
    if (!currentVideoFrame || !currentFrameAnalysis || activeTab !== 'video') return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 크기 맞춤
    const rect = video.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 비디오 파일은 좌우반전 없이 그대로 렌더링
    drawSkeletonOnCanvas(ctx, currentVideoFrame.keypoints, currentFrameAnalysis);
  }, [currentVideoFrame, currentFrameAnalysis, videoRef, activeTab]);

  // 웹캠 켜기
  const startWebcam = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = stream;
        webcamVideoRef.current.onloadedmetadata = () => {
          webcamVideoRef.current?.play();
          setWebcamActive(true);
          webcamActiveRef.current = true;
          resetRepState();
          setWebcamReps([]);
          setWebcamRepCount(0);
          setWebcamGoodReps(0);
          // 실시간 애니메이션 루프 실행
          requestRef.current = requestAnimationFrame(processWebcamFrame);
        };
      }
    } catch (err) {
      console.error(err);
      setError('카메라 장치 권한 획득에 실패했습니다. 브라우저의 카메라 설정을 확인해주세요.');
    }
  };

  // 웹캠 끄기
  const stopWebcam = () => {
    setWebcamActive(false);
    webcamActiveRef.current = false;
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    if (webcamVideoRef.current && webcamVideoRef.current.srcObject) {
      const stream = webcamVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      webcamVideoRef.current.srcObject = null;
    }
    isProcessingFrame.current = false;
    lastPoseFrame.current = null;
  };

  // 실시간 웹캠 랩 카운터 상태 머신
  const updateWebcamRepCounter = (res: PostureAnalysisResult) => {
    if (res.confidenceWarning) return;

    const kneeAngle = res.kneeAngle;
    const hipAngle = res.hipAngle;
    const currentTimeSec = Date.now() / 1000;

    if (res.exercise === 'squat') {
      if (repState.current === 'none') {
        if (kneeAngle < 140) {
          repState.current = 'descending';
          repStartTime.current = currentTimeSec;
          repWinkDetected.current = false;
          repMaxDepth.current = res.depth;
          repErrorTypes.current.clear();
        }
      } else if (repState.current === 'descending') {
        if (kneeAngle < 105) {
          repState.current = 'bottom';
        } else if (kneeAngle > 145) {
          repState.current = 'none'; // 도중 상승 혹은 포기
        }
        if (res.hasButtWink) {
          repWinkDetected.current = true;
          repErrorTypes.current.add('골반 말림 (Butt-wink)');
        }
        if (res.depth === 'parallel' && repMaxDepth.current === 'partial') repMaxDepth.current = 'parallel';
        if (res.depth === 'deep') repMaxDepth.current = 'deep';
      } else if (repState.current === 'bottom') {
        if (kneeAngle > 115) {
          repState.current = 'ascending';
        }
        if (res.hasButtWink) {
          repWinkDetected.current = true;
          repErrorTypes.current.add('골반 말림 (Butt-wink)');
        }
        if (res.depth === 'parallel' && repMaxDepth.current === 'partial') repMaxDepth.current = 'parallel';
        if (res.depth === 'deep') repMaxDepth.current = 'deep';
      } else if (repState.current === 'ascending') {
        if (kneeAngle > 145) {
          // 스쿼트 완료
          const isGoodDepth = repMaxDepth.current === 'parallel' || repMaxDepth.current === 'deep';
          if (!isGoodDepth) {
            repErrorTypes.current.add('깊이 부족');
          }
          const isGoodRep = isGoodDepth && !repWinkDetected.current;

          setWebcamReps((prev) => {
            const newRep = {
              id: crypto.randomUUID(),
              repIndex: prev.length + 1,
              duration: Math.round((currentTimeSec - repStartTime.current) * 10) / 10,
              maxDepth: repMaxDepth.current,
              isGood: isGoodRep,
              errorType: Array.from(repErrorTypes.current),
            };
            return [...prev, newRep];
          });

          setWebcamRepCount((c) => c + 1);
          if (isGoodRep) {
            setWebcamGoodReps((g) => g + 1);
            speak('좋은 자세예요!', soundEnabled);
          } else {
            if (repWinkDetected.current) {
              speak('골반 자세 확인!', soundEnabled);
            } else {
              speak('조금 더 깊게!', soundEnabled);
            }
          }

          repState.current = 'none';
        } else if (kneeAngle < 105) {
          repState.current = 'bottom';
        }
        if (res.hasButtWink) {
          repWinkDetected.current = true;
          repErrorTypes.current.add('골반 말림 (Butt-wink)');
        }
      }
    } else {
      // 데드리프트 웹캠 카운터
      if (repState.current === 'none') {
        if (hipAngle < 140) {
          repState.current = 'descending'; // 힙 힌지 개시
          repStartTime.current = currentTimeSec;
          repBackRounding.current = false;
          repErrorTypes.current.clear();
        }
      } else if (repState.current === 'descending') {
        if (hipAngle < 90) {
          repState.current = 'bottom'; // 바닥 셋업
        } else if (hipAngle > 155) {
          repState.current = 'none';
        }
        if (res.hasBackRounding) {
          repBackRounding.current = true;
          repErrorTypes.current.add('등허리 굽음');
        }
      } else if (repState.current === 'bottom') {
        if (hipAngle > 95) {
          repState.current = 'ascending'; // 뽑아 올림
        }
        if (res.hasBackRounding) {
          repBackRounding.current = true;
          repErrorTypes.current.add('등허리 굽음');
        }
      } else if (repState.current === 'ascending') {
        if (hipAngle > 155 && kneeAngle > 160) {
          // 데드리프트 락아웃 완료
          const isGoodRep = !repBackRounding.current;
          setWebcamReps((prev) => {
            const newRep = {
              id: crypto.randomUUID(),
              repIndex: prev.length + 1,
              duration: Math.round((currentTimeSec - repStartTime.current) * 10) / 10,
              maxDepth: 'standing' as const,
              isGood: isGoodRep,
              errorType: Array.from(repErrorTypes.current),
            };
            return [...prev, newRep];
          });

          setWebcamRepCount((c) => c + 1);
          if (isGoodRep) {
            setWebcamGoodReps((g) => g + 1);
            speak('좋은 자세예요!', soundEnabled);
          } else {
            speak('허리 자세 확인!', soundEnabled);
          }

          repState.current = 'none';
        } else if (hipAngle < 90) {
          repState.current = 'bottom';
        }
        if (res.hasBackRounding) {
          repBackRounding.current = true;
          repErrorTypes.current.add('등허리 굽음');
        }
      }
    }
  };

  // 실시간 웹캠 프레임 처리 루프
  const processWebcamFrame = async () => {
    const video = webcamVideoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.paused || video.ended || !webcamActiveRef.current) {
      if (webcamActiveRef.current) {
        requestRef.current = requestAnimationFrame(processWebcamFrame);
      }
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      requestRef.current = requestAnimationFrame(processWebcamFrame);
      return;
    }

    // 반응형 크기 세팅
    const rect = video.getBoundingClientRect();
    canvas.width = rect.width || 640;
    canvas.height = rect.height || 480;



    // 1) 캔버스에 웹캠 프레임 그리기 (사용자에게 친숙하도록 좌우 반전 적용)
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // 2) AI 추론 (프레임 드랍 및 UI 렉을 피하기 위해 비동기 제한)
    if (!isProcessingFrame.current) {
      isProcessingFrame.current = true;
      try {
        const det = await initPoseDetector();
        // 캔버스 자체 이미지 분석
        const poses = await det.estimatePoses(canvas);

        if (poses[0]) {
          const keypoints = poses[0].keypoints;
          const res =
            exercise === 'squat'
              ? analyzeSquatFrame(keypoints)
              : analyzeDeadliftFrame(keypoints);

          setLiveAnalysis(res);
          updateWebcamRepCounter(res);

          // 드로잉 캐싱
          lastPoseFrame.current = { keypoints, result: res };
        } else {
          setLiveAnalysis(null);
        }
        isProcessingFrame.current = false;
      } catch (err) {
        console.error('Frame estimation error:', err);
        isProcessingFrame.current = false;
      }
    }

    // 3) 스켈레톤 레이아웃 그리기
    if (lastPoseFrame.current) {
      drawSkeletonOnCanvas(
        ctx,
        lastPoseFrame.current.keypoints,
        lastPoseFrame.current.result
      );
    }

    if (webcamActiveRef.current) {
      requestRef.current = requestAnimationFrame(processWebcamFrame);
    }
  };


  // 녹화된 비디오 분석 실행
  const runVideoAnalysis = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !blobUrl) return;

    setAnalyzing(true);
    setError(null);
    setProgress(0);

    try {
      const result = await detectPoseInVideo(video, setProgress, 10); // 10 FPS 분석
      setFrames(result);

      // 영상 전체 랩 카운팅 자동 스캔
      const scannedReps = scanVideoReps(result, exercise);
      setVideoReps(scannedReps);

      // 분석 로컬 데이터 저장 포맷 생성
      const tfResult: TFAnalysisResult = {
        frames: result,
        fps: 10,
        duration: video.duration,
        analyzedAt: new Date().toISOString(),
      };

      saveAnalysis({
        id: crypto.randomUUID(),
        name: fileName ?? '운동 영상 분석',
        exercise: exercise,
        result: tfResult,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '비디오 분석 중 에러가 발생했습니다.');
    } finally {
      setAnalyzing(false);
    }
  }, [videoRef, blobUrl, fileName, exercise]);

  // 비디오 파일 랩 카운터 스캐너 (전체 프레임 배열 분석용)
  function scanVideoReps(poseFrames: PoseFrame[], curExercise: 'squat' | 'deadlift') {
    const reps: Array<{ id: string; repIndex: number; duration: number; maxDepth: string; isGood: boolean; errorType: string[] }> = [];
    let state: 'none' | 'descending' | 'bottom' | 'ascending' = 'none';
    let startTimestamp = 0;
    let hasWinkOrRounding = false;
    let maxDepth: 'standing' | 'partial' | 'parallel' | 'deep' = 'standing';
    const errors = new Set<string>();

    for (const frame of poseFrames) {
      const res =
        curExercise === 'squat'
          ? analyzeSquatFrame(frame.keypoints)
          : analyzeDeadliftFrame(frame.keypoints);

      if (res.confidenceWarning) continue;

      const kneeAngle = res.kneeAngle;
      const hipAngle = res.hipAngle;

      if (curExercise === 'squat') {
        if (state === 'none') {
          if (kneeAngle < 140) {
            state = 'descending';
            startTimestamp = frame.timestamp;
            hasWinkOrRounding = false;
            maxDepth = res.depth;
            errors.clear();
          }
        } else if (state === 'descending') {
          if (kneeAngle < 105) {
            state = 'bottom';
          } else if (kneeAngle > 145) {
            state = 'none';
          }
          if (res.hasButtWink) {
            hasWinkOrRounding = true;
            errors.add('골반 말림 (Butt-wink)');
          }
          if (res.depth === 'parallel' && maxDepth === 'partial') maxDepth = 'parallel';
          if (res.depth === 'deep') maxDepth = 'deep';
        } else if (state === 'bottom') {
          if (kneeAngle > 115) {
            state = 'ascending';
          }
          if (res.hasButtWink) {
            hasWinkOrRounding = true;
            errors.add('골반 말림 (Butt-wink)');
          }
          if (res.depth === 'parallel' && maxDepth === 'partial') maxDepth = 'parallel';
          if (res.depth === 'deep') maxDepth = 'deep';
        } else if (state === 'ascending') {
          if (kneeAngle > 145) {
            const isGoodDepth = maxDepth === 'parallel' || maxDepth === 'deep';
            if (!isGoodDepth) {
              errors.add('깊이 부족');
            }
            reps.push({
              id: crypto.randomUUID(),
              repIndex: reps.length + 1,
              startTime: startTimestamp,
              endTime: frame.timestamp,
              maxDepth,
              isGood: isGoodDepth && !hasWinkOrRounding,
              errorType: Array.from(errors),
            });
            state = 'none';
          } else if (kneeAngle < 105) {
            state = 'bottom';
          }
          if (res.hasButtWink) {
            hasWinkOrRounding = true;
            errors.add('골반 말림 (Butt-wink)');
          }
        }
      } else {
        // 데드리프트 스캐너
        if (state === 'none') {
          if (hipAngle < 140) {
            state = 'descending';
            startTimestamp = frame.timestamp;
            hasWinkOrRounding = false;
            errors.clear();
          }
        } else if (state === 'descending') {
          if (hipAngle < 90) {
            state = 'bottom';
          } else if (hipAngle > 155) {
            state = 'none';
          }
          if (res.hasBackRounding) {
            hasWinkOrRounding = true;
            errors.add('등허리 굽음');
          }
        } else if (state === 'bottom') {
          if (hipAngle > 95) {
            state = 'ascending';
          }
          if (res.hasBackRounding) {
            hasWinkOrRounding = true;
            errors.add('등허리 굽음');
          }
        } else if (state === 'ascending') {
          if (hipAngle > 155 && kneeAngle > 160) {
            reps.push({
              id: crypto.randomUUID(),
              repIndex: reps.length + 1,
              startTime: startTimestamp,
              endTime: frame.timestamp,
              maxDepth: 'standing',
              isGood: !hasWinkOrRounding,
              errorType: Array.from(errors),
            });
            state = 'none';
          } else if (hipAngle < 90) {
            state = 'bottom';
          }
          if (res.hasBackRounding) {
            hasWinkOrRounding = true;
            errors.add('등허리 굽음');
          }
        }
      }
    }
    return reps;
  };

  // 세션 결과 로컬 스토리지에 저장
  const saveSessionReport = () => {
    let newSession: SavedSession;
    if (activeTab === 'webcam') {
      if (webcamRepCount === 0) return;
      newSession = {
        id: crypto.randomUUID(),
        date: new Date().toLocaleString('ko-KR'),
        exercise,
        totalReps: webcamRepCount,
        goodReps: webcamGoodReps,
        successRate: Math.round((webcamGoodReps / webcamRepCount) * 100),
        notes: webcamReps.some((r) => !r.isGood)
          ? `벗윙크 또는 깊이 부족 발견, 다음 세트에서 개선해보세요`
          : '완벽한 세트! 💪',
      };
    } else {
      if (videoReps.length === 0) return;
      const goodCount = videoReps.filter((r) => r.isGood).length;
      newSession = {
        id: crypto.randomUUID(),
        date: new Date().toLocaleString('ko-KR'),
        exercise,
        totalReps: videoReps.length,
        goodReps: goodCount,
        successRate: Math.round((goodCount / videoReps.length) * 100),
        notes: videoReps.some((r) => !r.isGood)
          ? `${exercise === 'squat' ? '하단에서 허리 자세 개선 필요' : '바닥에서 올릴 때 허리 주의'}`
          : '완벽한 세트! 💪',
      };
    }

    const updated = [newSession, ...savedSessions].slice(0, 15); // 최대 15개 저장
    setSavedSessions(updated);
    localStorage.setItem('poemtech_session_history', JSON.stringify(updated));
    setSaveSuccessMsg('기록이 저장됐어요! 📝');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // 기록 삭제
  const deleteSession = (id: string) => {
    const filtered = savedSessions.filter((s) => s.id !== id);
    setSavedSessions(filtered);
    localStorage.setItem('poemtech_session_history', JSON.stringify(filtered));
  };

  // 비디오 파일 업로드 핸들러
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      clear();
      setFrames([]);
      setVideoReps([]);
      setCurrentFrameAnalysis(null);
      loadFile(file);
    }
  };

  // 가이드 패널 체크 유효성 검사
  const prepGuideReady = guideAngle && guideFullBody && guideClothing && guideConsent;

  return (
    <div className="pose-analyzer">
      {/* 상단 컨트롤 바 */}
      <div className="top-bar flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 md:mb-6 bg-card p-3 md:p-4 rounded-xl md:rounded-2xl border border-white/5 gap-3 md:gap-0">
        <div className="status-indicator font-bold text-sm md:text-base">
          {modelReady ? (
            <span className="ready text-success flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
              AI 엔진 활성화됨
            </span>
          ) : error ? (
            <span className="error text-red">{error}</span>
          ) : (
            <span className="loading text-yellow flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-yellow border-t-transparent rounded-full animate-spin"></span>
              AI 모델 불러오는 중...
            </span>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-start sm:items-center w-full sm:w-auto">
          <label className="flex items-center gap-2 text-sm text-muted cursor-pointer hover:text-white transition-colors bg-elevated/50 px-3 py-1.5 rounded-lg border border-white/5">
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={() => setSoundEnabled(!soundEnabled)}
              className="accent-accent"
            />
            🔊 음성 코칭
          </label>
        </div>
      </div>

      {/* 탭 인터페이스 & 운동 선택바 */}
      <div className="analyzer-tabs flex flex-col lg:flex-row gap-4 mb-4 md:mb-6 border-b border-white/10 pb-4 justify-between items-start lg:items-center">
        {/* 카메라/영상 탭 */}
        <div className="flex gap-2 w-full lg:w-auto overflow-x-auto hide-scrollbar pb-2 lg:pb-0 border-b lg:border-none border-white/5">
          <button
            type="button"
            className={`tab-btn px-4 md:px-6 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${
              activeTab === 'webcam' ? 'bg-accent text-bg shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'bg-elevated/50 text-muted hover:bg-elevated'
            }`}
            onClick={() => handleTabChange('webcam')}
          >
            🎥 실시간 카메라
          </button>
          <button
            type="button"
            className={`tab-btn px-4 md:px-6 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${
              activeTab === 'video' ? 'bg-accent text-bg shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'bg-elevated/50 text-muted hover:bg-elevated'
            }`}
            onClick={() => handleTabChange('video')}
          >
            📁 영상 업로드
          </button>
        </div>

        {/* 운동 선택 */}
        <div className="flex w-full lg:w-auto justify-between lg:justify-end items-center gap-4">
          <div className="exercise-selector flex items-center gap-2 bg-elevated/30 p-1.5 rounded-xl border border-white/5 w-full sm:w-auto overflow-x-auto">
            <button
              type="button"
              className={`flex-1 sm:flex-none px-3 md:px-5 py-2 rounded-lg text-sm md:text-base font-bold transition-all whitespace-nowrap ${
                exercise === 'squat' ? 'bg-accent text-bg shadow-sm' : 'text-muted hover:text-white'
              }`}
              onClick={() => handleExerciseChange('squat')}
            >
              🏋️ 스쿼트
            </button>
            <button
              type="button"
              className={`flex-1 sm:flex-none px-3 md:px-5 py-2 rounded-lg text-sm md:text-base font-bold transition-all whitespace-nowrap ${
                exercise === 'deadlift' ? 'bg-accent text-bg shadow-sm' : 'text-muted hover:text-white'
              }`}
              onClick={() => handleExerciseChange('deadlift')}
            >
              🏋️ 데드리프트
            </button>
          </div>
        </div>
      </div>

      {/* 촬영 가이드 팝업/패널 */}
      {showPrepGuide && (
        <div className="prep-guide-card bg-card border border-accent rounded-radius p-5 mb-6 relative">
          <button
            type="button"
            className="absolute top-3 right-3 text-muted hover:text-white"
            onClick={() => setShowPrepGuide(false)}
          >
            ✕ 닫기
          </button>
          <h4 className="text-accent font-bold mb-3">📋 정확한 분석을 위해 체크해주세요</h4>
          <p className="text-sm text-muted mb-4">
            정확한 폼 분석을 위한 간단한 준비사항이에요:
          </p>
          <div className="checklist-grid grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <label className="checklist-item flex items-start gap-2 bg-elevated p-3 rounded-lg border border-border cursor-pointer">
              <input
                type="checkbox"
                checked={guideAngle}
                onChange={() => setGuideAngle(!guideAngle)}
              />
              <div>
                <strong className="text-sm block">1. 측면에서 촬영하기</strong>
                <span className="text-xs text-muted">완전한 측면에서 촬영해주세요. 정면이나 대각선은 정확도가 떨어져요.</span>
              </div>
            </label>
            <label className="checklist-item flex items-start gap-2 bg-elevated p-3 rounded-lg border border-border cursor-pointer">
              <input
                type="checkbox"
                checked={guideFullBody}
                onChange={() => setGuideFullBody(!guideFullBody)}
              />
              <div>
                <strong className="text-sm block">2. 전신이 다 보이게</strong>
                <span className="text-xs text-muted">머리부터 발끝까지 전부 화면에 나와야 해요.</span>
              </div>
            </label>
            <label className="checklist-item flex items-start gap-2 bg-elevated p-3 rounded-lg border border-border cursor-pointer">
              <input
                type="checkbox"
                checked={guideClothing}
                onChange={() => setGuideClothing(!guideClothing)}
              />
              <div>
                <strong className="text-sm block">3. 관절이 잘 보이는 옷</strong>
                <span className="text-xs text-muted">헐렁한 옷보다 타이트한 운동복을 입으면 분석이 더 정확해져요.</span>
              </div>
            </label>
            <label className="checklist-item flex items-start gap-2 bg-elevated p-3 rounded-lg border border-border cursor-pointer">
              <input
                type="checkbox"
                checked={guideConsent}
                onChange={() => setGuideConsent(!guideConsent)}
              />
              <div>
                <strong className="text-sm block">4. 자동 일시정지 동의</strong>
                <span className="text-xs text-muted">관절이 잘 안 보일 때는 정확도를 위해 분석이 잠시 멈춰요.</span>
              </div>
            </label>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted">영상은 내 기기에서만 처리돼요. 외부 전송 없음 🔒</span>
            <button
              type="button"
              className="primary-btn bg-accent text-bg text-sm px-4 py-2"
              disabled={!prepGuideReady}
              onClick={() => setShowPrepGuide(false)}
            >
              준비 완료!
            </button>
          </div>
        </div>
      )}

      {/* 메인 분석 레이아웃 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽 2열: 비디오/카메라 스크린 */}
        <div className="lg:col-span-2">
          {activeTab === 'webcam' ? (
            <div className="webcam-pane flex flex-col">
              <div className="video-container bg-black rounded-radius overflow-hidden border border-border relative aspect-video flex justify-center items-center">
                <video
                  ref={webcamVideoRef}
                  className="hidden"
                  playsInline
                  muted
                />
                <canvas ref={canvasRef} className="w-full h-full block" />

                {/* 신뢰도 경고 오버레이 */}
                {liveAnalysis?.confidenceWarning && (
                  <div className="absolute inset-0 bg-black/75 flex flex-col justify-center items-center p-6 text-center z-10">
                    <span className="text-4xl mb-2">⚠️</span>
                    <h5 className="text-lg font-bold text-red mb-1">관절이 잘 안 보여요</h5>
                    <p className="text-sm text-muted max-w-sm">
                      관절({liveAnalysis.lowConfidenceJoints.join(', ')})이 가려져 있거나 어두워서 인식이 어려워요. 카메라 위치를 조정해주세요.
                    </p>
                  </div>
                )}

                {/* 미활성화 대기화면 */}
                {!webcamActive && (
                  <div className="absolute inset-0 bg-elevated flex flex-col justify-center items-center p-6 text-center">
                    <span className="text-5xl mb-4">🎥</span>
                    <p className="font-bold mb-2">실시간 AI 폼 체크</p>
                    <small className="text-muted mb-4 max-w-xs">
                      카메라를 켜고 운동을 시작하면 AI가 실시간으로 자세를 분석해줘요.
                    </small>
                    <button
                      type="button"
                      className="primary-btn bg-accent text-bg px-6 py-3 font-bold"
                      onClick={startWebcam}
                      disabled={!modelReady}
                    >
                      카메라 켜기
                    </button>
                  </div>
                )}
              </div>

              {/* 실시간 웹캠 컨트롤 */}
              {webcamActive && (
                <div className="flex justify-between items-center mt-3 bg-card p-3 rounded-radius border border-border">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green animate-pulse"></span>
                    <span className="text-sm font-semibold">카메라 ON</span>
                  </div>
                  <button
                    type="button"
                    className="secondary-btn border border-red text-red hover:bg-red/10 px-4 py-1 text-sm rounded-md"
                    onClick={stopWebcam}
                  >
                    카메라 끄기
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="video-file-pane flex flex-col">
              {!blobUrl ? (
                <label className="upload-zone large border border-dashed border-border rounded-radius flex flex-col items-center justify-center p-8 bg-card cursor-pointer hover:bg-elevated transition aspect-video">
                  <input type="file" accept="video/*" onChange={handleFileChange} hidden />
                  <div className="upload-content text-center">
                    <span className="upload-icon text-4xl block mb-2">📹</span>
                    <p className="font-bold">운동 영상 올리기</p>
                    <small className="text-muted block mt-1">MP4, MOV 지원 · 내 기기에서 분석</small>
                  </div>
                </label>
              ) : (
                <>
                  <div 
                    className={`video-container bg-black rounded-radius overflow-hidden border border-border relative touch-none ${drawMode === 'scrub' ? (isScrubbing ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
                    {...(drawMode === 'scrub' ? scrubHandlers : {})}
                  >
                    <video
                      ref={videoRef}
                      src={blobUrl}
                      className={`video-element w-full block max-h-[500px] object-contain ${drawMode === 'scrub' ? 'pointer-events-none' : ''}`}
                      playsInline
                    />
                    <canvas ref={canvasRef} className="skeleton-canvas absolute inset-0 pointer-events-none" />
                    
                    <CanvasOverlay
                      strokes={strokes}
                      width={dimensions.width}
                      height={dimensions.height}
                      interactive={drawMode !== 'scrub'}
                      onStartStroke={startStroke}
                      onContinueStroke={continueStroke}
                      onEndStroke={endStroke}
                    />

                    {/* 파일 모드 신뢰도 부족 경고 */}
                    {currentFrameAnalysis?.confidenceWarning && (
                      <div className="absolute top-3 left-3 bg-red/90 text-white text-xs px-2.5 py-1.5 rounded-md font-bold shadow-md">
                        ⚠️ {currentFrameAnalysis.lowConfidenceJoints.join(', ')} 인식이 어려워요
                      </div>
                    )}
                  </div>

                  <VideoControls
                    isPlaying={isPlaying}
                    currentTime={currentTime}
                    duration={duration}
                    playbackRate={playbackRate}
                    onTogglePlay={togglePlay}
                    onStepFrame={stepFrame}
                    onSeek={seek}
                    onSetRate={setRate}
                  />

                  <div className="drawing-toolbar mt-3 flex gap-2 items-center flex-wrap bg-elevated/50 p-2 md:p-3 rounded-xl border border-white/5">
                    <span className="text-sm font-bold text-accent mr-1 md:mr-2">도구</span>
                    {(['scrub', 'point', 'line', 'path'] as DrawMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={`px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm rounded-full transition-all ${drawMode === mode ? 'bg-accent text-bg font-bold shadow-md' : 'bg-card text-muted hover:text-white border border-white/5'}`}
                        onClick={() => setDrawMode(mode)}
                      >
                        {mode === 'scrub' ? '탐색' : mode === 'point' ? '관절' : mode === 'line' ? '선' : '궤적'}
                      </button>
                    ))}
                    <div className="flex-1 min-w-[20px]"></div>
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      title="색상"
                      className="w-8 h-8 rounded-full border-none p-0 cursor-pointer bg-transparent"
                    />
                    <button type="button" onClick={undo} className="text-xs md:text-sm text-muted hover:text-white px-2">
                      되돌리기
                    </button>
                    <button type="button" onClick={clearDrawing} className="text-xs md:text-sm text-red hover:text-red-400 px-2">
                      지우기
                    </button>
                  </div>

                  {/* AI 분석 실행 버튼 */}
                  <div className="analysis-actions flex gap-4 items-center mt-3 bg-card p-3 rounded-radius border border-border">
                    <button
                      type="button"
                      className="primary-btn bg-accent text-bg px-6 py-2.5 font-bold"
                      onClick={runVideoAnalysis}
                      disabled={analyzing || !modelReady}
                    >
                      {analyzing ? `분석 중... ${progress}%` : 'AI 폼 분석 시작'}
                    </button>
                    {frames.length > 0 && (
                      <span className="badge text-sm bg-green/20 text-accent font-semibold px-3 py-1.5 rounded-full">
                        {frames.length}개 프레임 분석 완료 ✨
                      </span>
                    )}
                    {blobUrl && (
                      <button
                        type="button"
                        className="text-xs text-muted hover:text-white underline ml-auto"
                        onClick={() => {
                          clear();
                          setFrames([]);
                          setVideoReps([]);
                        }}
                      >
                        영상 지우기
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* 하단 실시간 각도 피드백 패널 */}
          {((activeTab === 'webcam' && liveAnalysis) || (activeTab === 'video' && currentFrameAnalysis)) && (
            <div className="angles-panel mt-4 bg-card border border-border rounded-radius p-5">
              <h4 className="font-bold border-b border-border pb-2 mb-4 text-sm text-accent">
                📊 {exercise === 'squat' ? '스쿼트' : '데드리프트'} 실시간 폼 분석
              </h4>
              
              {/* 계측 데이터 그리드 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="angle-card bg-elevated rounded-lg p-3 flex flex-col">
                  <span className="angle-label text-xs text-muted">무릎 각도</span>
                  <span className="angle-value text-2xl font-bold text-accent">
                    {activeTab === 'webcam' ? liveAnalysis?.kneeAngle : currentFrameAnalysis?.kneeAngle}°
                  </span>
                </div>
                <div className="angle-card bg-elevated rounded-lg p-3 flex flex-col">
                  <span className="angle-label text-xs text-muted">골반 각도</span>
                  <span className="angle-value text-2xl font-bold text-accent">
                    {activeTab === 'webcam' ? liveAnalysis?.hipAngle : currentFrameAnalysis?.hipAngle}°
                  </span>
                </div>
                <div className="angle-card bg-elevated rounded-lg p-3 flex flex-col">
                  <span className="angle-label text-xs text-muted">등 각도</span>
                  <span className="angle-value text-2xl font-bold text-accent">
                    {activeTab === 'webcam' ? liveAnalysis?.backAngle : currentFrameAnalysis?.backAngle}°
                  </span>
                </div>
                <div className="angle-card bg-elevated rounded-lg p-3 flex flex-col">
                  <span className="angle-label text-xs text-muted">깊이</span>
                  <span className="angle-value text-lg font-bold text-accent uppercase">
                    {activeTab === 'webcam' ? liveAnalysis?.depth : currentFrameAnalysis?.depth}
                  </span>
                </div>
              </div>

              {/* 실시간 텍스트 피드백 카드 */}
              <div
                className={`feedback-box p-4 rounded-lg border text-sm font-semibold flex items-center gap-3 ${
                  (activeTab === 'webcam' ? liveAnalysis?.status : currentFrameAnalysis?.status) === 'danger'
                    ? 'bg-red/10 border-red text-red'
                    : (activeTab === 'webcam' ? liveAnalysis?.status : currentFrameAnalysis?.status) === 'warning'
                    ? 'bg-yellow/10 border-yellow text-yellow'
                    : 'bg-green/10 border-green text-green'
                }`}
              >
                <span className="text-xl">
                  {(activeTab === 'webcam' ? liveAnalysis?.status : currentFrameAnalysis?.status) === 'danger'
                    ? '🚨'
                    : (activeTab === 'webcam' ? liveAnalysis?.status : currentFrameAnalysis?.status) === 'warning'
                    ? '⚠️'
                    : '✅'}
                </span>
                <p className="margin-0 leading-relaxed">
                  {activeTab === 'webcam' ? liveAnalysis?.feedback : currentFrameAnalysis?.feedback}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 오른쪽 1열: 실시간 분석 결과 리포트 및 히스토리 로그 */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* 세션 통계 & 랩 리스트 */}
          <div className="reps-summary-panel bg-card border border-border rounded-radius p-5">
            <h4 className="font-bold mb-2">📊 이번 세트 기록</h4>
            <div className="flex gap-4 items-baseline mb-4 bg-elevated p-3 rounded-lg border border-border">
              <div>
                <span className="text-xs text-muted block">총 횟수</span>
                <span className="text-3xl font-bold">
                  {activeTab === 'webcam' ? webcamRepCount : videoReps.length}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted block">좋은 폼</span>
                <span className="text-3xl font-bold text-green">
                  {activeTab === 'webcam'
                    ? webcamGoodReps
                    : videoReps.filter((r) => r.isGood).length}
                </span>
              </div>
              <div className="ml-auto text-right">
                <span className="text-xs text-muted block">폼 정확도</span>
                <span className="text-xl font-bold text-accent">
                  {activeTab === 'webcam'
                    ? webcamRepCount > 0
                      ? `${Math.round((webcamGoodReps / webcamRepCount) * 100)}%`
                      : '0%'
                    : videoReps.length > 0
                    ? `${Math.round((videoReps.filter((r) => r.isGood).length / videoReps.length) * 100)}%`
                    : '0%'}
                </span>
              </div>
            </div>

            {/* 개별 랩 리스트 */}
            <div className="rep-list-scroll max-h-[220px] overflow-y-auto flex flex-col gap-2 pr-1">
              {activeTab === 'webcam' ? (
                webcamReps.length === 0 ? (
                  <p className="text-xs text-muted text-center py-6">
                    카메라를 켜고 운동을 시작하면 횟수와 자세가 자동으로 기록돼요.
                  </p>
                ) : (
                  webcamReps.map((rep) => (
                    <div
                      key={rep.id}
                      className={`rep-item-row p-2.5 rounded-md border flex justify-between items-center text-xs ${
                        rep.isGood ? 'bg-green/10 border-green/30 text-green' : 'bg-red/10 border-red/30 text-red'
                      }`}
                    >
                      <div>
                        <strong className="block text-sm">{rep.repIndex}회차</strong>
                        <span className="text-muted">{rep.duration}초</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold block">{rep.isGood ? '좋아요 👍' : '폼 체크!'}</span>
                        {rep.errorType.length > 0 ? (
                          <span className="text-[10px] text-red-400">{rep.errorType.join(', ')}</span>
                        ) : (
                          <span className="text-[10px] text-muted uppercase">{rep.maxDepth}</span>
                        )}
                      </div>
                    </div>
                  ))
                )
              ) : videoReps.length === 0 ? (
                <p className="text-xs text-muted text-center py-6">
                  영상을 올리고 AI 분석을 실행하면 세트별 운동 기록이 여기에 표시돼요.
                </p>
              ) : (
                videoReps.map((rep) => (
                  <div
                    key={rep.id}
                    className={`rep-item-row p-2.5 rounded-md border flex justify-between items-center text-xs ${
                      rep.isGood ? 'bg-green/10 border-green/30 text-green' : 'bg-red/10 border-red/30 text-red'
                    }`}
                  >
                    <div>
                      <strong className="block text-sm">{rep.repIndex}회차</strong>
                      <span className="text-muted">{Math.round(rep.startTime * 10) / 10}초 지점</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="font-bold block">{rep.isGood ? '좋아요 👍' : '폼 체크!'}</span>
                        {rep.errorType.length > 0 ? (
                          <span className="text-[10px] text-red-400">{rep.errorType.join(', ')}</span>
                        ) : (
                          <span className="text-[10px] text-muted uppercase">{rep.maxDepth}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="bg-elevated border border-border text-[10px] px-1.5 py-1 rounded text-white hover:border-accent"
                        onClick={() => seek(rep.startTime)}
                      >
                        이동
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 기록 세션 보고서 저장 */}
            <div className="mt-4 border-t border-border pt-4">
              <button
                type="button"
                className="primary-btn bg-accent text-bg w-full font-bold text-sm py-2"
                onClick={saveSessionReport}
                disabled={
                  activeTab === 'webcam'
                    ? webcamRepCount === 0
                    : videoReps.length === 0
                }
              >
                💾 이번 세트 기록 저장
              </button>
              {saveSuccessMsg && (
                <p className="text-xs text-green text-center mt-2 font-semibold">{saveSuccessMsg}</p>
              )}
            </div>
          </div>

          {/* 로컬 DB 저장 로그 히스토리 */}
          <div className="saved-history-panel bg-card border border-border rounded-radius p-5">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-bold">📂 내 운동 기록</h4>
              <span className="text-[10px] bg-border px-2 py-0.5 rounded text-muted">최대 15개</span>
            </div>
            
            <div className="history-list max-h-[300px] overflow-y-auto flex flex-col gap-2">
              {savedSessions.length === 0 ? (
                <p className="text-xs text-muted text-center py-8">
                  아직 저장된 기록이 없어요. 운동 후 기록을 저장해보세요!
                </p>
              ) : (
                savedSessions.map((session) => (
                  <div
                    key={session.id}
                    className="history-item bg-elevated border border-border rounded p-3 text-xs relative"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-accent">
                        {session.exercise === 'squat' ? '🏋️ 스쿼트' : '🏋️ 데드리프트'}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted">{session.date}</span>
                        <button
                          type="button"
                          className="text-muted hover:text-red border-none bg-transparent cursor-pointer p-0 text-sm leading-none"
                          onClick={() => deleteSession(session.id)}
                          title="기록 지우기"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-4 text-muted mb-1.5">
                      <span>총: <strong>{session.totalReps}회</strong></span>
                      <span>좋은 폼: <strong className="text-green">{session.goodReps}회</strong></span>
                      <span>정확도: <strong className="text-accent">{session.successRate}%</strong></span>
                    </div>
                    <p className="m-0 text-muted italic bg-card p-1.5 rounded text-[11px]">
                      {session.notes}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
