export function Feedback() {
  return (
    <div className="feedback-page min-h-screen py-16 px-4 flex flex-col items-center justify-center">
      <div className="max-w-2xl w-full bg-card rounded-[30px] border border-border p-8 md:p-12 text-center shadow-2xl relative overflow-hidden">
        {/* 장식 효과 */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

        <div className="relative z-10">
          <span className="inline-flex items-center justify-center rounded-lg border border-accent bg-accent/10 px-3 py-1 text-sm font-semibold text-accent uppercase tracking-wide mb-6">
            Pro Feedback
          </span>
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">
            전문가의 <span className="text-accent">1:1 맞춤 피드백</span>
          </h1>
          <p className="text-lg text-muted mb-8 max-w-lg mx-auto leading-relaxed">
            AI 분석으로 부족하셨나요? 현직 트레이너가 직접 영상을 보고 문제점과 교정 운동 루틴을 설계해드립니다.
          </p>

          <div className="bg-elevated rounded-2xl p-6 mb-8 text-left border border-white/5">
            <h3 className="font-bold text-xl text-white mb-4">피드백 포함 내역</h3>
            <ul className="space-y-3">
              <li className="flex items-start">
                <span className="text-accent mr-3">✓</span>
                <span className="text-white/80">영상 정밀 분석 및 근본적인 원인 파악</span>
              </li>
              <li className="flex items-start">
                <span className="text-accent mr-3">✓</span>
                <span className="text-white/80">개인별 체형을 고려한 맞춤형 자세 교정 가이드</span>
              </li>
              <li className="flex items-start">
                <span className="text-accent mr-3">✓</span>
                <span className="text-white/80">약점 보완을 위한 2주간의 보조 운동 루틴 설계</span>
              </li>
              <li className="flex items-start">
                <span className="text-accent mr-3">✓</span>
                <span className="text-white/80">카카오톡 1:1 Q&amp;A (피드백 수령 후 3일간)</span>
              </li>
            </ul>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="text-3xl font-bold text-white">
              건당 <span className="text-accent">9,900</span>원
            </div>
            <button className="w-full md:w-auto px-8 py-4 rounded-full bg-accent text-white font-bold text-lg transition-transform hover:scale-105 hover:shadow-[0_0_20px_rgba(255,90,43,0.4)]">
              지금 바로 피드백 신청하기
            </button>
            <p className="text-sm text-muted mt-2">결제 후 24시간 이내에 분석 결과가 발송됩니다.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
