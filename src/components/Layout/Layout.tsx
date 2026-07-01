import { Link, Outlet, useLocation } from 'react-router-dom';
import { usePWAInstall } from '../../hooks/usePWAInstall';

const NAV = [
  { path: '/', label: '소개' },
  { path: '/analysis', label: 'AI 폼 체킹' },
];



export function Layout() {
  const location = useLocation();
  const { isInstallable, handleInstallClick } = usePWAInstall();

  return (
    <div className="app-layout">
      <header className="app-header flex flex-col md:flex-row items-center justify-between px-4 py-3 md:px-8 md:py-4 border-b border-white/10 bg-card/90 backdrop-blur-md sticky top-0 z-50">
        <Link to="/" className="logo flex items-center gap-2 font-bold text-xl text-accent mb-3 md:mb-0">
          <img src="/logo-white.png" alt="FormTech Logo" className="h-7 w-auto object-contain" />
          <span>FormTech</span>
        </Link>
        <nav className="flex items-center gap-2 overflow-x-auto w-full md:w-auto justify-center hide-scrollbar">
          {NAV.map(({ path, label }) => (
            <Link
              key={path}
              to={path}
              className={`px-3 py-1.5 md:px-4 md:py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                location.pathname === path 
                  ? 'bg-accent/10 text-accent' 
                  : 'text-muted hover:bg-white/5 hover:text-white'
              }`}
            >
              {label}
            </Link>
          ))}
          {isInstallable && (
            <button
              onClick={handleInstallClick}
              className="px-3 py-1.5 md:px-4 md:py-2 rounded-full text-sm font-bold whitespace-nowrap bg-accent text-bg hover:brightness-110 active:brightness-95 transition-all shadow-[0_0_15px_rgba(0,255,136,0.3)] ml-2"
            >
              📱 앱 설치
            </button>
          )}
        </nav>
      </header>

      <main className="app-main flex-1 w-full max-w-7xl mx-auto px-4 py-6 md:px-8 md:py-8">
        <Outlet />
      </main>

      <footer className="app-footer border-t border-white/10 bg-card/50 pt-10 pb-8 px-4 text-xs text-muted">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-8">
          {/* 서비스 정보 영역 (무료 배포용) */}
          <div className="flex-1 space-y-2">
            <div className="font-bold text-white text-sm mb-3">FormTech (무료 AI 폼 체커)</div>
            <p>이메일 문의: twkang1332@gmail.com</p>
            <p className="mt-4 text-white/40">
              ※ FormTech의 AI 분석 결과는 참고용이며 의학적 진단을 대체하지 않습니다.
            </p>
          </div>

          {/* 정책 및 링크 영역 */}
          <div className="flex flex-col items-start md:items-end gap-3">
            <div className="flex gap-4 font-semibold text-white/80">
              <Link to="/terms" className="hover:text-accent transition-colors">이용약관</Link>
              <Link to="/privacy" className="hover:text-accent transition-colors text-accent">개인정보처리방침</Link>
            </div>
            <p className="text-white/40 mt-2">
              모든 분석은 내 기기 안에서만 처리되며 외부로 전송되지 않습니다 🔒
            </p>
            <p className="text-white/40">
              Copyright © {new Date().getFullYear()} FormTech. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
