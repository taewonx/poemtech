import type { PostureAnalysisResult } from '../../utils/angles';

interface AnglesFeedbackProps {
  exercise: 'squat' | 'deadlift';
  analysisResult: PostureAnalysisResult;
  isWebcam: boolean;
}

export function AnglesFeedback({ analysisResult }: AnglesFeedbackProps) {
  return (
    <div className="w-full flex flex-col md:flex-row gap-3 mt-3 mb-1">
      {/* 실시간 텍스트 피드백 배너 */}
      <div
        className={`flex-1 p-4 rounded-xl shadow-sm border text-base font-bold flex items-center gap-3 ${
          analysisResult.status === 'danger'
            ? 'bg-red/20 border-red/50 text-red-500'
            : analysisResult.status === 'warning'
            ? 'bg-yellow/20 border-yellow/50 text-yellow-500'
            : 'bg-green/20 border-green/50 text-green-500'
        } animate-fade-in`}
      >
        <span className="text-2xl leading-none">
          {analysisResult.status === 'danger'
            ? '🚨'
            : analysisResult.status === 'warning'
            ? '⚠️'
            : '✅'}
        </span>
        <p className="margin-0 leading-tight">
          {analysisResult.feedback}
        </p>
      </div>

      {/* 계측 데이터 HUD */}
      <div className="md:w-[320px] bg-card border border-border rounded-xl p-3 shadow-sm shrink-0">
        <div className="grid grid-cols-4 gap-2 h-full">
          <div className="flex flex-col justify-center items-center p-2 bg-elevated rounded-lg">
            <span className="text-[10px] text-muted mb-1">KNEE</span>
            <span className="text-sm font-bold text-white">{analysisResult.kneeAngle}°</span>
          </div>
          <div className="flex flex-col justify-center items-center p-2 bg-elevated rounded-lg">
            <span className="text-[10px] text-muted mb-1">HIP</span>
            <span className="text-sm font-bold text-white">{analysisResult.hipAngle}°</span>
          </div>
          <div className="flex flex-col justify-center items-center p-2 bg-elevated rounded-lg">
            <span className="text-[10px] text-muted mb-1">BACK</span>
            <span className="text-sm font-bold text-white">{analysisResult.backAngle}°</span>
          </div>
          <div className="flex flex-col justify-center items-center p-2 bg-elevated rounded-lg">
            <span className="text-[10px] text-muted mb-1">DEPTH</span>
            <span className="text-sm font-bold text-white uppercase">{analysisResult.depth}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
