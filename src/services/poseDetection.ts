import type { PoseFrame, PoseKeypoint } from '../types';

type PoseDetectorModule = typeof import('@tensorflow-models/pose-detection');

let detector: Awaited<
  ReturnType<PoseDetectorModule['createDetector']>
> | null = null;

export async function initPoseDetector() {
  if (detector) return detector;

  const [poseDetection, tf] = await Promise.all([
    import('@tensorflow-models/pose-detection'),
    import('@tensorflow/tfjs'),
  ]);

  await tf.setBackend('webgl');
  await tf.ready();

  detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet,
    {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    },
  );

  return detector;
}

export async function detectPoseInVideo(
  video: HTMLVideoElement,
  onProgress?: (percent: number) => void,
  fps = 5, // 기존 10fps에서 5fps로 줄여 분석 속도 2배 향상 (운동 분석에 5fps도 충분함)
): Promise<PoseFrame[]> {
  const det = await initPoseDetector();
  const frames: PoseFrame[] = [];
  const duration = video.duration;
  const interval = 1 / fps;
  
  // 비디오 해상도가 너무 높을 경우 렌더링 부하를 막기 위해 최대 크기 제한
  const MAX_WIDTH = 640;
  let canvasW = video.videoWidth;
  let canvasH = video.videoHeight;
  
  if (canvasW > MAX_WIDTH) {
    const scale = MAX_WIDTH / canvasW;
    canvasW = MAX_WIDTH;
    canvasH = canvasH * scale;
  }

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d')!;

  const originalTime = video.currentTime;
  video.pause();

  for (let t = 0; t < duration; t += interval) {
    video.currentTime = t;
    await new Promise<void>((resolve) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };
      video.addEventListener('seeked', onSeeked);
    });

    ctx.drawImage(video, 0, 0, canvasW, canvasH);
    const poses = await det.estimatePoses(canvas);

    if (poses[0]) {
      const keypoints: PoseKeypoint[] = poses[0].keypoints.map((kp) => ({
        x: kp.x / (canvasW / (video.videoWidth || 1)),
        y: kp.y / (canvasH / (video.videoHeight || 1)),
        z: kp.z ? kp.z / (canvasW / (video.videoWidth || 1)) : undefined,
        score: kp.score,
        name: kp.name,
      }));

      frames.push({
        frameIndex: frames.length,
        timestamp: t,
        keypoints,
      });
    }

    onProgress?.(Math.min(100, Math.round((t / duration) * 100)));
  }

  video.currentTime = originalTime;
  onProgress?.(100);
  return frames;
}

export function findClosestFrame(
  frames: PoseFrame[],
  timestamp: number,
): PoseFrame | null {
  if (frames.length === 0) return null;
  return frames.reduce((closest, frame) =>
    Math.abs(frame.timestamp - timestamp) <
    Math.abs(closest.timestamp - timestamp)
      ? frame
      : closest,
  );
}
