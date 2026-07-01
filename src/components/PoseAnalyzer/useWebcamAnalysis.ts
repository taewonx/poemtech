import { useCallback, useRef, useState, useEffect } from 'react';
import { initPoseDetector } from '../../services/poseDetection';
import { analyzeSquatFrame, analyzeDeadliftFrame } from '../../utils/angles';
import type { PostureAnalysisResult } from '../../utils/angles';
import { drawSkeletonOnCanvas } from '../../utils/skeleton';
import { createInitialRepState, processRepFrame, type RepCounterState } from '../../utils/repCounter';
import { speak } from '../../utils/speech';
import type { RepRecord, PoseKeypoint } from '../../types';

interface UseWebcamAnalysisOptions {
  exercise: 'squat' | 'deadlift';
  soundEnabled: boolean;
}

export function useWebcamAnalysis({ exercise, soundEnabled }: UseWebcamAnalysisOptions) {
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [webcamActive, setWebcamActive] = useState(false);
  const webcamActiveRef = useRef(false);
  
  const [liveAnalysis, setLiveAnalysis] = useState<PostureAnalysisResult | null>(null);
  const [webcamReps, setWebcamReps] = useState<RepRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const requestRef = useRef<number | null>(null);
  const isProcessingFrame = useRef(false);
  
  const repState = useRef<RepCounterState>(createInitialRepState());
  const lastPoseFrame = useRef<{ keypoints: PoseKeypoint[], result: PostureAnalysisResult } | null>(null);

  // 추가 고도화 상태 변수
  const lastSpeechTime = useRef<number>(0);
  const lastSpeechText = useRef<string>('');
  const lastKneeAngle = useRef<number>(180);
  const lastKneeTime = useRef<number>(0);
  const soundEnabledRef = useRef(soundEnabled);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const startWebcam = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'environment' },
        audio: false,
      });

      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = stream;
        webcamVideoRef.current.onloadedmetadata = () => {
          webcamVideoRef.current?.play();
          setWebcamActive(true);
          webcamActiveRef.current = true;
          repState.current = createInitialRepState();
          setWebcamReps([]);
          requestRef.current = requestAnimationFrame(processWebcamFrame);
        };
      }
    } catch (err) {
      console.error(err);
      setError('카메라 장치 권한 획득에 실패했습니다. 브라우저의 카메라 설정을 확인해주세요.');
    }
  };

  const stopWebcam = useCallback(() => {
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
    lastSpeechTime.current = 0;
    lastSpeechText.current = '';
    lastKneeTime.current = 0;
  }, []);

  const updateRepCounter = (res: PostureAnalysisResult) => {
    const timestampSec = Date.now() / 1000;
    const newRep = processRepFrame(res, timestampSec, repState.current, webcamReps.length);
    
    if (newRep) {
      setWebcamReps((prev) => [...prev, newRep]);
        if (newRep.isGood) {
          speak('좋은 자세예요!', soundEnabledRef.current);
        } else {
          const hasWink = newRep.errorType.some(e => e.includes('벗윙크'));
          const hasRound = newRep.errorType.some(e => e.includes('등허리'));
          if (hasWink) speak('골반 자세 확인!', soundEnabledRef.current);
          else if (hasRound) speak('허리 자세 확인!', soundEnabledRef.current);
          else speak('조금 더 깊게!', soundEnabledRef.current);
        }
    }
  };

  const processWebcamFrame = async () => {
    const video = webcamVideoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.paused || video.ended || !webcamActiveRef.current) {
      if (webcamActiveRef.current) requestRef.current = requestAnimationFrame(processWebcamFrame);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      requestRef.current = requestAnimationFrame(processWebcamFrame);
      return;
    }

    const rect = video.getBoundingClientRect();
    canvas.width = rect.width || 640;
    canvas.height = rect.height || 480;

    // 거울 모드 렌더링
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    if (!isProcessingFrame.current) {
      isProcessingFrame.current = true;
      try {
        const det = await initPoseDetector();
        const poses = await det.estimatePoses(canvas);

        if (poses[0]) {
          const keypoints = poses[0].keypoints;
          const res = exercise === 'squat' 
            ? analyzeSquatFrame(keypoints) 
            : analyzeDeadliftFrame(keypoints);

          // eslint-disable-next-line react-hooks/purity
          const nowMs = Date.now();

          // 1. 하강 속도(Velocity) 기반 피드백 (스쿼트)
          if (exercise === 'squat' && res.status !== 'danger') {
            if (lastKneeTime.current > 0) {
              const dt = (nowMs - lastKneeTime.current) / 1000;
              if (dt > 0.05) {
                const dAngle = lastKneeAngle.current - res.kneeAngle;
                const angleVelocity = dAngle / dt; // 양수면 하강 중
                
                if (angleVelocity > 150 && res.kneeAngle > 90 && res.kneeAngle < 160) {
                  res.status = 'warning';
                  res.feedback = '너무 빠릅니다! 천천히 내려가세요';
                }
                
                lastKneeAngle.current = res.kneeAngle;
                lastKneeTime.current = nowMs;
              }
            } else {
              lastKneeAngle.current = res.kneeAngle;
              lastKneeTime.current = nowMs;
            }
          }

          // 2. 실시간 TTS 중복 방지 (1회 반복 중 중복 재생 방지)
          if (res.status === 'danger' || res.status === 'warning') {
            if (nowMs - lastSpeechTime.current > 3000 && lastSpeechText.current !== res.feedback) {
              speak(res.feedback, soundEnabledRef.current);
              lastSpeechTime.current = nowMs;
              lastSpeechText.current = res.feedback;
            }
          } else if (res.depth === 'standing') {
            lastSpeechText.current = ''; // 동작이 끝나고 서있을 때만 텍스트를 초기화하여 중복 방지
          }

          setLiveAnalysis(res);
          updateRepCounter(res);
          lastPoseFrame.current = { keypoints, result: res };
        } else {
          setLiveAnalysis(null);
        }
      } catch (err) {
        console.error('Frame estimation error:', err);
      } finally {
        isProcessingFrame.current = false;
      }
    }

    if (lastPoseFrame.current) {
      drawSkeletonOnCanvas(ctx, lastPoseFrame.current.keypoints, lastPoseFrame.current.result);
    }

    if (webcamActiveRef.current) {
      requestRef.current = requestAnimationFrame(processWebcamFrame);
    }
  };

  return {
    webcamVideoRef,
    canvasRef,
    webcamActive,
    startWebcam,
    stopWebcam,
    liveAnalysis,
    webcamReps,
    setWebcamReps,
    webcamError: error,
    repState,
  };
}
