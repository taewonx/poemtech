import { PoseAnalyzer } from '../components/PoseAnalyzer/PoseAnalyzer';

export function PoseAnalysis() {
  return (
    <div className="page pose-page">
      <header className="mb-6 md:mb-10 text-center">
        <h1 className="text-2xl md:text-4xl font-bold mb-2 md:mb-4">실시간 AI 폼 체크</h1>
        <p className="text-sm md:text-base text-muted max-w-2xl mx-auto px-4">
          스쿼트·데드리프트할 때 자세가 잘 잡혀있는지, AI가 실시간으로 분석해줘요. 측면에서 찍어주세요!
        </p>
      </header>

      <PoseAnalyzer />
    </div>
  );
}


