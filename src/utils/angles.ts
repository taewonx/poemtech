import type { PoseKeypoint } from '../types';

/** 세 점 사이의 각도 (도 단위) */
export function calculateAngle(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number {
  const rad =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let deg = (rad * 180) / Math.PI;
  if (deg < 0) deg += 360;
  if (deg > 180) deg = 360 - deg;
  return Math.round(deg);
}

export function findKeypoint(
  keypoints: PoseKeypoint[],
  names: string[],
): PoseKeypoint | undefined {
  return keypoints.find((kp) => kp.name && names.includes(kp.name));
}

/** 운동 폼 분석에 자주 쓰이는 관절 각도 */
export function extractFormAngles(keypoints: PoseKeypoint[]) {
  const leftElbow = findKeypoint(keypoints, ['left_elbow']);
  const leftShoulder = findKeypoint(keypoints, ['left_shoulder']);
  const leftWrist = findKeypoint(keypoints, ['left_wrist']);
  const rightElbow = findKeypoint(keypoints, ['right_elbow']);
  const rightShoulder = findKeypoint(keypoints, ['right_shoulder']);
  const rightWrist = findKeypoint(keypoints, ['right_wrist']);
  const leftHip = findKeypoint(keypoints, ['left_hip']);
  const leftKnee = findKeypoint(keypoints, ['left_knee']);
  const leftAnkle = findKeypoint(keypoints, ['left_ankle']);
  const rightHip = findKeypoint(keypoints, ['right_hip']);
  const rightKnee = findKeypoint(keypoints, ['right_knee']);
  const rightAnkle = findKeypoint(keypoints, ['right_ankle']);

  const angles: Record<string, number | null> = {};

  if (leftShoulder && leftElbow && leftWrist) {
    angles.leftElbow = calculateAngle(leftShoulder, leftElbow, leftWrist);
  }
  if (rightShoulder && rightElbow && rightWrist) {
    angles.rightElbow = calculateAngle(rightShoulder, rightElbow, rightWrist);
  }
  if (leftHip && leftKnee && leftAnkle) {
    angles.leftKnee = calculateAngle(leftHip, leftKnee, leftAnkle);
  }
  if (rightHip && rightKnee && rightAnkle) {
    angles.rightKnee = calculateAngle(rightHip, rightKnee, rightAnkle);
  }
  if (leftShoulder && leftHip && leftKnee) {
    angles.leftHip = calculateAngle(leftShoulder, leftHip, leftKnee);
  }
  if (rightShoulder && rightHip && rightKnee) {
    angles.rightHip = calculateAngle(rightShoulder, rightHip, rightKnee);
  }

  return angles;
}

export interface JointConfidence {
  name: string;
  score: number;
  isOk: boolean;
}

export interface PostureAnalysisResult {
  exercise: 'squat' | 'deadlift';
  kneeAngle: number;
  hipAngle: number;
  backAngle: number; // 등/몸통 기울기 각도
  status: 'good' | 'warning' | 'danger';
  feedback: string;
  hasButtWink: boolean;
  hasBackRounding: boolean;
  depth: 'standing' | 'partial' | 'parallel' | 'deep';
  confidenceScore: number;
  confidenceWarning: boolean;
  lowConfidenceJoints: string[];
}

/**
 * 측면 관절 중 신뢰도(Confidence Score)가 더 높은 쪽을 자동으로 선택
 */
export function getActiveSideKeypoints(keypoints: PoseKeypoint[]) {
  const leftShoulder = findKeypoint(keypoints, ['left_shoulder']);
  const leftHip = findKeypoint(keypoints, ['left_hip']);
  const leftKnee = findKeypoint(keypoints, ['left_knee']);
  const leftAnkle = findKeypoint(keypoints, ['left_ankle']);

  const rightShoulder = findKeypoint(keypoints, ['right_shoulder']);
  const rightHip = findKeypoint(keypoints, ['right_hip']);
  const rightKnee = findKeypoint(keypoints, ['right_knee']);
  const rightAnkle = findKeypoint(keypoints, ['right_ankle']);

  const leftScore =
    ((leftShoulder?.score ?? 0) +
      (leftHip?.score ?? 0) +
      (leftKnee?.score ?? 0) +
      (leftAnkle?.score ?? 0)) /
    4;

  const rightScore =
    ((rightShoulder?.score ?? 0) +
      (rightHip?.score ?? 0) +
      (rightKnee?.score ?? 0) +
      (rightAnkle?.score ?? 0)) /
    4;

  // 더 선명하게 보이는 쪽(Confidence 점수가 높은 쪽)을 활성 측면으로 판단
  if (leftScore >= rightScore) {
    return {
      side: 'left' as const,
      shoulder: leftShoulder,
      hip: leftHip,
      knee: leftKnee,
      ankle: leftAnkle,
      averageScore: leftScore,
    };
  } else {
    return {
      side: 'right' as const,
      shoulder: rightShoulder,
      hip: rightHip,
      knee: rightKnee,
      ankle: rightAnkle,
      averageScore: rightScore,
    };
  }
}

/**
 * 실시간 스쿼트 자세 분석 로직 (벗윙크 및 깊이 감지)
 */
export function analyzeSquatFrame(keypoints: PoseKeypoint[]): PostureAnalysisResult {
  const { shoulder, hip, knee, ankle, averageScore } = getActiveSideKeypoints(keypoints);

  const result: PostureAnalysisResult = {
    exercise: 'squat',
    kneeAngle: 180,
    hipAngle: 180,
    backAngle: 0,
    status: 'good',
    feedback: '좋은 자세예요! 💪',
    hasButtWink: false,
    hasBackRounding: false,
    depth: 'standing',
    confidenceScore: averageScore,
    confidenceWarning: false,
    lowConfidenceJoints: [],
  };

  // 주요 관절 중 하나라도 감지가 불가능하거나 신뢰도가 너무 낮은 경우 예외 처리
  const MIN_CONFIDENCE = 0.45;
  const joints = [
    { name: '어깨', kp: shoulder },
    { name: '골반', kp: hip },
    { name: '무릎', kp: knee },
    { name: '발목', kp: ankle },
  ];

  for (const j of joints) {
    if (!j.kp || (j.kp.score !== undefined && j.kp.score < MIN_CONFIDENCE)) {
      result.lowConfidenceJoints.push(j.name);
    }
  }

  if (result.lowConfidenceJoints.length > 0) {
    result.confidenceWarning = true;
    result.status = 'warning';
    result.feedback = `${result.lowConfidenceJoints.join(', ')}이(가) 잘 안 보여요. 카메라를 조정해주세요`;
    return result;
  }

  // 안전하게 keypoints 좌표가 존재하는 것으로 간주
  const s = shoulder!;
  const h = hip!;
  const k = knee!;
  const a = ankle!;

  // 각도 계산
  const kneeAngle = calculateAngle(h, k, a);
  const hipAngle = calculateAngle(s, h, k);
  
  // 등/척추 각도 계산 (수직선 기준 기울기)
  const backRad = Math.atan2(Math.abs(s.x - h.x), Math.abs(s.y - h.y));
  const backAngle = Math.round((backRad * 180) / Math.PI);

  result.kneeAngle = kneeAngle;
  result.hipAngle = hipAngle;
  result.backAngle = backAngle;

  // 스쿼트 깊이 판단
  if (kneeAngle > 140) {
    result.depth = 'standing';
    result.feedback = '서있는 자세, 안정적이에요 👍';
  } else if (kneeAngle > 105) {
    result.depth = 'partial';
    result.feedback = '내려가는 중이에요';
  } else if (kneeAngle > 85) {
    result.depth = 'parallel';
    result.feedback = '좋은 깊이에요! 수평 도달 👍';
  } else {
    result.depth = 'deep';
    result.feedback = '깊은 스쿼트 도달! 🔥';
  }

  // 벗윙크(골반 말림) 감지 Heuristic:
  // 스쿼트 하단부(Knee Angle < 105도)에서 요추가 무너지거나 골반이 뒤로 둥글게 말려들어가는 현상
  // 1) 고관절 각도가 과도하게 좁아지거나(hipAngle < 55도)
  // 2) 깊게 내려갔는데 척추선이 무너져 hipAngle이 무릎 굽힘 대비 과도하게 말려들어가는 조건 (hipAngle < 60 && kneeAngle < 90)
  // 3) 상체가 너무 과도하게 앞으로 숙여지는 경우 (backAngle > 45도, 즉 요추에 과도한 부하가 걸리는 상태)
  const isBottom = kneeAngle < 105;
  if (isBottom) {
    if (hipAngle < 55) {
      result.hasButtWink = true;
      result.status = 'danger';
      result.feedback = '골반이 말려요! 벗윙크 감지 ⚠️';
    } else if (backAngle > 45) {
      result.status = 'warning';
      result.feedback = '상체가 너무 숙여졌어요';
    } else if (hipAngle < 60 && kneeAngle < 92) {
      result.hasButtWink = true;
      result.status = 'danger';
      result.feedback = '벗윙크 위험! 골반 자세를 확인하세요 🚨';
    }
  }

  return result;
}

/**
 * 실시간 데드리프트 자세 분석 로직 (허리 굽음 및 바 경로/무릎 쏠림 감지)
 */
export function analyzeDeadliftFrame(keypoints: PoseKeypoint[]): PostureAnalysisResult {
  const { shoulder, hip, knee, ankle, averageScore } = getActiveSideKeypoints(keypoints);

  const result: PostureAnalysisResult = {
    exercise: 'deadlift',
    kneeAngle: 180,
    hipAngle: 180,
    backAngle: 0,
    status: 'good',
    feedback: '좋은 자세예요! 💪',
    hasButtWink: false,
    hasBackRounding: false,
    depth: 'standing',
    confidenceScore: averageScore,
    confidenceWarning: false,
    lowConfidenceJoints: [],
  };

  const MIN_CONFIDENCE = 0.45;
  const joints = [
    { name: '어깨', kp: shoulder },
    { name: '골반', kp: hip },
    { name: '무릎', kp: knee },
    { name: '발목', kp: ankle },
  ];

  for (const j of joints) {
    if (!j.kp || (j.kp.score !== undefined && j.kp.score < MIN_CONFIDENCE)) {
      result.lowConfidenceJoints.push(j.name);
    }
  }

  if (result.lowConfidenceJoints.length > 0) {
    result.confidenceWarning = true;
    result.status = 'warning';
    result.feedback = `${result.lowConfidenceJoints.join(', ')}이(가) 잘 안 보여요. 카메라를 조정해주세요`;
    return result;
  }

  const s = shoulder!;
  const h = hip!;
  const k = knee!;
  const a = ankle!;

  const kneeAngle = calculateAngle(h, k, a);
  const hipAngle = calculateAngle(s, h, k);
  
  // 등/척추 각도 (수직선 기준 기울기)
  const backRad = Math.atan2(Math.abs(s.x - h.x), Math.abs(s.y - h.y));
  const backAngle = Math.round((backRad * 180) / Math.PI);

  result.kneeAngle = kneeAngle;
  result.hipAngle = hipAngle;
  result.backAngle = backAngle;

  // 데드리프트 단계 판단 (무릎 굽힘 및 고관절 각도로 추정)
  if (kneeAngle > 165 && hipAngle > 160) {
    result.depth = 'standing'; // 완전히 선 상태 (락아웃)
  } else if (kneeAngle > 140 && hipAngle < 120) {
    result.depth = 'partial'; // 숙이는 도중 / 세미 락아웃
    result.feedback = '내려가는 중이에요';
  } else {
    result.depth = 'parallel'; // 셋업 또는 바닥 자세 (First pull)
    result.feedback = '바닥 자세 도달! 🔥';
  }

  // 데드리프트 허리 굽음(Back Rounding) Heuristic:
  // 상체를 많이 숙인 상태(hipAngle < 90도)에서, 무릎은 이미 많이 펴졌는데(`kneeAngle > 145도`)
  // 척추를 곧게 펴지 못하고 엉덩이가 먼저 올라가 등허리가 굽는 상태(Spine/Torso가 과도하게 눕는 경우)
  const isPulling = hipAngle < 100;
  if (isPulling) {
    // 엉덩이가 먼저 솟구쳐서 허리 부담이 극대화되는 Stripper Pull / Rounded back 상태
    if (kneeAngle > 140 && hipAngle < 75) {
      result.hasBackRounding = true;
      result.status = 'danger';
      result.feedback = '허리가 굽어요! ⚠️';
    } else if (backAngle > 55) {
      result.hasBackRounding = true;
      result.status = 'danger';
      result.feedback = '상체가 너무 숙여졌어요 ⚠️';
    } else if (kneeAngle < 100 && h.x > k.x + 20) {
      // 무릎이 앞으로 과도하게 밀리는 Knee Drift
      result.status = 'warning';
      result.feedback = '무릎이 앞으로 밀려요';
    }
  }


  return result;
}

