import { Link } from 'react-router-dom';

export function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full">
      
      {/* Hero Section */}
      <section className="text-center max-w-4xl px-4 py-12 md:py-24">
        <div className="inline-block px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-sm font-bold mb-6 animate-slide-up">
          ✨ 100% 무료 · 영상 저장 X
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight tracking-tight animate-slide-up stagger-1">
          당신의 운동을 완벽하게 분석하는<br />
          <span className="bg-gradient-to-r from-accent via-[#ff79c6] to-accent bg-clip-text text-transparent animate-float inline-block">차세대 AI 포즈 체커</span>
        </h1>
        <p className="text-base md:text-xl text-muted mb-10 max-w-2xl mx-auto leading-relaxed animate-slide-up stagger-2">
          서버 전송 없이 내 기기에서 바로 분석하는 완벽한 프라이버시.
          실시간 웹캠부터 영상 업로드까지, AI가 즉각적인 피드백과 음성 코칭을 제공합니다.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-slide-up stagger-3">
          <Link 
            to="/analysis" 
            className="primary-btn bg-accent text-bg px-8 py-4 text-lg font-bold rounded-full hover:scale-105 transition-transform shadow-[0_0_20px_rgba(168,85,247,0.4)] w-full sm:w-auto"
          >
            🚀 지금 바로 시작하기
          </Link>
          <a href="#features" className="px-8 py-4 text-lg font-bold rounded-full border border-white/10 hover:bg-white/5 transition-colors w-full sm:w-auto text-center">
            기능 살펴보기 ↓
          </a>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="w-full max-w-6xl px-4 py-16 md:py-24 border-t border-white/5">
        <div className="text-center mb-12 md:mb-16 animate-slide-up">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">왜 FormTech 인가요?</h2>
          <p className="text-muted text-sm md:text-base">전문가의 눈을 대신하는 강력한 분석 도구를 제공합니다.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          
          {/* Feature 1 */}
          <div className="bg-card border border-border p-6 md:p-8 rounded-2xl hover:border-accent/50 hover:-translate-y-2 hover:shadow-[0_10px_30px_rgba(168,85,247,0.15)] transition-all duration-300 group animate-slide-up stagger-1">
            <div className="text-4xl mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 origin-left">🔒</div>
            <h3 className="text-xl font-bold mb-3 text-white group-hover:text-accent transition-colors">완벽한 프라이버시</h3>
            <p className="text-muted text-sm leading-relaxed">
              모든 영상 분석은 브라우저(내 기기) 내부에서만 이루어집니다. 외부 서버로 어떠한 영상이나 데이터도 전송되지 않아 안심하고 사용할 수 있습니다.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-card border border-border p-6 md:p-8 rounded-2xl hover:border-[#00ff88]/50 hover:-translate-y-2 hover:shadow-[0_10px_30px_rgba(0,255,136,0.15)] transition-all duration-300 group animate-slide-up stagger-2">
            <div className="text-4xl mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 origin-left">🤖</div>
            <h3 className="text-xl font-bold mb-3 text-white group-hover:text-[#00ff88] transition-colors">실시간 AI 폼 체킹</h3>
            <p className="text-muted text-sm leading-relaxed">
              사용자의 주요 관절 움직임을 AI가 실시간으로 정밀하게 추적하여, 올바른 스쿼트와 데드리프트 자세를 가이드하고 위험한 자세를 경고합니다.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-card border border-border p-6 md:p-8 rounded-2xl hover:border-[#1e90ff]/50 hover:-translate-y-2 hover:shadow-[0_10px_30px_rgba(30,144,255,0.15)] transition-all duration-300 group animate-slide-up stagger-3">
            <div className="text-4xl mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 origin-left">🎥</div>
            <h3 className="text-xl font-bold mb-3 text-white group-hover:text-[#1e90ff] transition-colors">실시간 & 영상 파일 지원</h3>
            <p className="text-muted text-sm leading-relaxed">
              스마트폰 웹캠이나 PC 카메라로 실시간 자세 교정을 받거나, 기존에 촬영해둔 MP4/MOV 운동 영상을 업로드하여 정밀 분석할 수 있습니다.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="bg-card border border-border p-6 md:p-8 rounded-2xl hover:border-[#ff4757]/50 hover:-translate-y-2 hover:shadow-[0_10px_30px_rgba(255,71,87,0.15)] transition-all duration-300 group animate-slide-up stagger-4">
            <div className="text-4xl mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 origin-left">📢</div>
            <h3 className="text-xl font-bold mb-3 text-white group-hover:text-[#ff4757] transition-colors">즉각적인 음성 코칭</h3>
            <p className="text-muted text-sm leading-relaxed">
              운동 중 화면을 계속 확인하기 어려우신가요? 즉시 반응하는 음성 코칭을 켜두면, 자세 교정 피드백을 실시간 오디오로 들으며 운동에 집중할 수 있습니다.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="bg-card border border-border p-6 md:p-8 rounded-2xl hover:border-[#ffa502]/50 hover:-translate-y-2 hover:shadow-[0_10px_30px_rgba(255,165,2,0.15)] transition-all duration-300 group animate-slide-up stagger-5">
            <div className="text-4xl mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 origin-left">⚡</div>
            <h3 className="text-xl font-bold mb-3 text-white group-hover:text-[#ffa502] transition-colors">압도적인 퍼포먼스</h3>
            <p className="text-muted text-sm leading-relaxed">
              최신 WebGL 및 WebAssembly 기술을 활용하여 무거운 앱 설치 없이도 스마트폰 브라우저에서 초당 30프레임 이상의 부드러운 실시간 분석을 제공합니다.
            </p>
          </div>

          {/* Feature 6 */}
          <Link to="/analysis" className="bg-accent/10 border border-accent/30 p-6 md:p-8 rounded-2xl hover:bg-accent/20 hover:border-accent hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(168,85,247,0.3)] transition-all duration-300 group flex flex-col justify-center items-center text-center cursor-pointer animate-slide-up stagger-5">
            <div className="text-4xl mb-3 group-hover:scale-125 group-hover:-rotate-6 transition-transform duration-300 animate-float">🔥</div>
            <h3 className="text-xl font-bold mb-2 text-white group-hover:text-accent transition-colors">준비되셨나요?</h3>
            <span className="text-accent font-bold group-hover:underline">무료로 분석 시작하기 →</span>
          </Link>

        </div>
      </section>

    </div>
  );
}
