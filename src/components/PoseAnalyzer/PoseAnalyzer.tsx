import { useCallback, useEffect, useState, useRef } from 'react';
import { analyzeSquatFrame, analyzeDeadliftFrame } from '../../utils/angles';
import { detectPoseInVideo, findClosestFrame, initPoseDetector } from '../../services/poseDetection';
import { saveAnalysis } from '../../utils/storage';
import { scanVideoReps } from '../../utils/repCounter';
import { stopSpeech, speak } from '../../utils/speech';
import type { PoseFrame, RepRecord, PoseAnalysisResult as TFAnalysisResult } from '../../types';

import { useBlobUrl } from '../../hooks/useBlobUrl';
import { useVideoPlayer } from '../../hooks/useVideoPlayer';
import { useGuidelineState } from './useGuidelineState';
import { useWebcamAnalysis } from './useWebcamAnalysis';

import { VideoControls } from '../VideoPlayer/VideoControls';
import { GuidelinePanel } from './GuidelinePanel';
import { AnglesFeedback } from './AnglesFeedback';
import { LeadGenResultPanel } from './LeadGenResultPanel';
import { drawSkeletonOnCanvas } from '../../utils/skeleton';

export function PoseAnalyzer() {
  const { blobUrl, fileName, loadFile, clear: clearBlob } = useBlobUrl();
  const {
    videoRef, isPlaying, currentTime, duration, playbackRate,
    togglePlay, seek, stepFrame, setRate,
  } = useVideoPlayer({ src: blobUrl });
  const guideline = useGuidelineState();

  const [activeTab, setActiveTab] = useState<'webcam' | 'video'>('webcam');
  const [exercise, setExercise] = useState<'squat' | 'deadlift'>('squat');
  const [modelReady, setModelReady] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // 웹캠 훅
  const {
    webcamVideoRef, canvasRef: webcamCanvasRef, webcamActive, startWebcam, stopWebcam,
    liveAnalysis, webcamReps, setWebcamReps, webcamError,
  } = useWebcamAnalysis({ exercise, soundEnabled });

  // 비디오 파일 제어 상태
  const [frames, setFrames] = useState<PoseFrame[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoReps, setVideoReps] = useState<RepRecord[]>([]);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 640, height: 360 });
  const videoCanvasRef = useRef<HTMLCanvasElement>(null);

  // 비디오 해상도 추적
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const updateSize = () => {
      const rect = video.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({ width: rect.width, height: rect.height });
      }
    };
    video.addEventListener('loadedmetadata', updateSize);
    window.addEventListener('resize', updateSize);
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
      .catch(() => setVideoError('AI 모델 로딩에 실패했습니다.'));
  }, []);

  // 탭 및 종목 변경 핸들러
  const handleSoundToggle = () => {
    const nextState = !soundEnabled;
    setSoundEnabled(nextState);
    if (!nextState) {
      stopSpeech();
    } else {
      speak('음성 코칭이 켜졌습니다', true);
    }
  };
  const handleTabChange = (tab: 'webcam' | 'video') => {
    setActiveTab(tab);
    stopWebcam();
  };

  const handleExerciseChange = (newEx: 'squat' | 'deadlift') => {
    setExercise(newEx);
    setWebcamReps([]);
    setVideoReps([]);
    if (frames.length > 0) {
      setVideoReps(scanVideoReps(frames, newEx));
    }
  };

  // 파생 상태 (현재 프레임 분석 결과)
  const currentVideoFrame = (activeTab === 'video' && frames.length > 0) ? findClosestFrame(frames, currentTime) : null;
  const currentFrameAnalysis = currentVideoFrame 
    ? (exercise === 'squat' ? analyzeSquatFrame(currentVideoFrame.keypoints) : analyzeDeadliftFrame(currentVideoFrame.keypoints))
    : null;

  // 비디오 스켈레톤 렌더링
  useEffect(() => {
    if (!currentVideoFrame || !currentFrameAnalysis || activeTab !== 'video') return;
    const canvas = videoCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw > 0 && vh > 0) {
      const scale = Math.min(canvas.width / vw, canvas.height / vh);
      const dw = vw * scale;
      const dh = vh * scale;
      const ox = (canvas.width - dw) / 2;
      const oy = (canvas.height - dh) / 2;

      const scaledKeypoints = currentVideoFrame.keypoints.map(kp => ({
        ...kp,
        x: kp.x * scale + ox,
        y: kp.y * scale + oy
      }));

      drawSkeletonOnCanvas(ctx, scaledKeypoints, currentFrameAnalysis);
    }
  }, [currentVideoFrame, currentFrameAnalysis, videoRef, activeTab, dimensions]);

  // 녹화된 비디오 분석 실행
  const runVideoAnalysis = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !blobUrl) return;
    setAnalyzing(true);
    setVideoError(null);
    setProgress(0);

    try {
      const result = await detectPoseInVideo(video, setProgress, 10);
      setFrames(result);
      setVideoReps(scanVideoReps(result, exercise));

      const tfResult: TFAnalysisResult = { frames: result, fps: 10, duration: video.duration, analyzedAt: new Date().toISOString() };
      saveAnalysis({
        id: crypto.randomUUID(),
        name: fileName ?? '운동 영상 분석',
        exercise: exercise,
        result: tfResult,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      setVideoError(e instanceof Error ? e.message : '비디오 분석 중 에러가 발생했습니다.');
    } finally {
      setAnalyzing(false);
    }
  }, [videoRef, blobUrl, fileName, exercise]);

  // session handling removed

  const handleResetVideo = () => {
    clearBlob();
    setFrames([]);
    setVideoReps([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        alert('최대 50MB 이하의 영상만 업로드할 수 있습니다. 길이를 줄여서 다시 시도해주세요.');
        e.target.value = '';
        return;
      }
      handleResetVideo();
      loadFile(file);
    }
  };

  const currentReps = activeTab === 'webcam' ? webcamReps : videoReps;
  
  const error = activeTab === 'webcam' ? webcamError : videoError;

  return (
    <div className="pose-analyzer">
      <div className="top-bar flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 md:mb-6 bg-card p-3 md:p-4 rounded-xl md:rounded-2xl border border-white/5 gap-3 md:gap-0">
        <div className="status-indicator font-bold text-sm md:text-base w-full">
          {modelReady ? (
            <span className="ready text-success flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span> AI 엔진 활성화됨
            </span>
          ) : error ? (
            <span className="error text-red">{error}</span>
          ) : (
            <span className="loading text-yellow flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-yellow border-t-transparent rounded-full animate-spin"></span> 모델 로딩 중...
            </span>
          )}
        </div>
      </div>

      <div className="analyzer-tabs flex flex-col lg:flex-row gap-4 mb-4 md:mb-6 border-b border-white/10 pb-4 justify-between items-start lg:items-center">
        <div className="flex flex-wrap gap-3 w-full lg:w-auto pb-2 lg:pb-0 border-b lg:border-none border-white/5 p-1">
          <button
            type="button"
            className={`tab-btn relative px-4 md:px-6 py-2.5 rounded-lg font-bold transition-all border-2 flex-1 sm:flex-none ${activeTab === 'webcam' ? 'bg-accent/20 border-accent text-white scale-105 z-10' : 'bg-elevated/30 border-transparent text-muted hover:text-white'}`}
            onClick={() => handleTabChange('webcam')}
          >
            🎥 실시간 카메라
          </button>
          <button
            type="button"
            className={`tab-btn relative px-4 md:px-6 py-2.5 rounded-lg font-bold transition-all border-2 flex-1 sm:flex-none ${activeTab === 'video' ? 'bg-accent/20 border-accent text-white scale-105 z-10' : 'bg-elevated/30 border-transparent text-muted hover:text-white'}`}
            onClick={() => handleTabChange('video')}
          >
            📁 영상 업로드
          </button>
        </div>
        <div className="exercise-selector flex gap-2 bg-elevated/30 p-1.5 rounded-xl border border-white/5 w-full sm:w-[280px]">
          <button type="button" className={`flex-1 whitespace-nowrap px-3 py-2 rounded-lg text-sm font-bold transition-all ${exercise === 'squat' ? 'bg-accent text-bg' : 'text-muted'}`} onClick={() => handleExerciseChange('squat')}>🏋️ 스쿼트</button>
          <button type="button" className={`flex-1 whitespace-nowrap px-3 py-2 rounded-lg text-sm font-bold transition-all ${exercise === 'deadlift' ? 'bg-accent text-bg' : 'text-muted'}`} onClick={() => handleExerciseChange('deadlift')}>🏋️ 데드리프트</button>
        </div>
      </div>

      <GuidelinePanel exercise={exercise} {...guideline} />

      {guideline.hasCompletedGuide && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          <div className="lg:col-span-2">
            {activeTab === 'webcam' ? (
              <div className="webcam-pane flex flex-col">
                <div className="video-container bg-black rounded-radius overflow-hidden border border-border relative aspect-video flex justify-center items-center">
                  <video ref={webcamVideoRef} className="hidden" playsInline muted />
                  <canvas ref={webcamCanvasRef} className="w-full h-full block" />
                  {liveAnalysis?.confidenceWarning && (
                    <div className="absolute inset-0 bg-black/75 flex flex-col justify-center items-center p-6 text-center z-10">
                      <h5 className="text-lg font-bold text-red mb-1">인식이 어려워요</h5>
                      <p className="text-sm text-muted">관절이 가려져 있거나 어두워서 인식이 어려워요.</p>
                    </div>
                  )}
                  {!webcamActive && (
                    <div className="absolute inset-0 bg-elevated flex flex-col justify-center items-center p-4">
                      <p className="font-bold mb-2">실시간 AI 폼 체크</p>
                      <button type="button" className="primary-btn bg-accent text-bg px-6 py-2.5 font-bold text-lg rounded-xl flex items-center gap-3 transition-all shadow-[0_0_20px_rgba(0,255,136,0.4)] hover:shadow-[0_0_30px_rgba(0,255,136,0.6)] hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none" onClick={startWebcam} disabled={!modelReady}>
                        📷 <span>카메라 켜기</span>
                      </button>
                    </div>
                  )}
                  {liveAnalysis && webcamActive && <AnglesFeedback exercise={exercise} analysisResult={liveAnalysis} isWebcam={true} />}
                </div>
                <div className="flex justify-between items-center mt-3 bg-card p-3 rounded-radius border border-border">
                  <div className="flex items-center gap-4">
                    {webcamActive ? (
                      <span className="text-sm font-semibold flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green animate-pulse"></span>카메라 ON</span>
                    ) : (
                      <span className="text-sm font-semibold flex items-center gap-2 text-muted"><span className="w-2 h-2 rounded-full bg-white/20"></span>카메라 OFF</span>
                    )}
                    <label className="flex items-center gap-2 text-sm text-muted cursor-pointer hover:text-white transition-colors bg-elevated/50 px-3 py-1.5 rounded-lg border border-white/5">
                      <input type="checkbox" checked={soundEnabled} onChange={handleSoundToggle} className="accent-accent" />
                      🔊 음성 코칭
                    </label>
                  </div>
                  {webcamActive ? (
                    <button type="button" className="secondary-btn bg-red/10 border border-red text-red font-bold px-5 py-1.5 text-sm rounded-lg flex items-center gap-2 hover:bg-red hover:text-white transition-all shadow-[0_0_10px_rgba(255,71,87,0.1)] hover:shadow-[0_0_20px_rgba(255,71,87,0.3)] hover:scale-105 active:scale-95" onClick={stopWebcam}>
                      ⏹️ 카메라 끄기
                    </button>
                  ) : (
                    <button type="button" className="primary-btn bg-accent text-bg font-bold px-5 py-1.5 text-sm rounded-lg flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(0,255,136,0.3)] hover:shadow-[0_0_25px_rgba(0,255,136,0.5)] hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none" onClick={startWebcam} disabled={!modelReady}>
                      📷 카메라 켜기
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="video-file-pane flex flex-col">
                {!blobUrl ? (
                  <label className="upload-zone large border border-dashed border-border rounded-radius flex flex-col items-center justify-center p-4 aspect-video bg-card cursor-pointer">
                    <input type="file" accept="video/*" onChange={handleFileChange} hidden />
                    <div className="upload-content text-center">
                      <span className="text-4xl mb-2 block">📁</span>
                      <p className="font-bold">운동 영상 올리기</p>
                      <p className="text-xs text-muted mt-2">최대 50MB (mp4, mov 등)</p>
                    </div>
                  </label>
                ) : (
                  <>
                    <div className="video-container bg-black rounded-radius overflow-hidden border border-border relative">
                      <video ref={videoRef} src={blobUrl} className="w-full block max-h-[500px] object-contain" playsInline />
                      <canvas ref={videoCanvasRef} className="absolute inset-0 pointer-events-none" />
                      {currentFrameAnalysis && <AnglesFeedback exercise={exercise} analysisResult={currentFrameAnalysis} isWebcam={false} />}
                    </div>
                    <VideoControls isPlaying={isPlaying} currentTime={currentTime} duration={duration} playbackRate={playbackRate} onTogglePlay={togglePlay} onStepFrame={stepFrame} onSeek={seek} onSetRate={setRate} />
                    
                    <div className="analysis-actions flex flex-wrap gap-4 mt-3 bg-card p-3 rounded-radius">
                      <button type="button" className="primary-btn bg-accent text-bg px-6 py-2 font-bold flex-1 sm:flex-none" onClick={runVideoAnalysis} disabled={analyzing || !modelReady}>
                        {analyzing ? `분석 중... ${progress}%` : frames.length > 0 ? '다시 분석하기' : 'AI 폼 분석 시작'}
                      </button>
                      <button type="button" className="secondary-btn bg-elevated text-white border border-white/10 px-6 py-2 font-bold hover:bg-white/5 transition-colors rounded-lg flex-1 sm:flex-none" onClick={handleResetVideo} disabled={analyzing}>
                        다른 영상 업로드
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="lg:col-span-1 flex flex-col gap-6">
            <LeadGenResultPanel 
              exercise={exercise} 
              reps={currentReps} 
              isAnalyzed={activeTab === 'video' ? frames.length > 0 : currentReps.length > 0} 
            />
          </div>
        </div>
      )}
    </div>
  );
}
