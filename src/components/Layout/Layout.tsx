import { Link, Outlet, useLocation } from 'react-router-dom';

const NAV = [
  { path: '/', label: 'AI 폼 체킹' },
  { path: '/feedback', label: '프로 피드백' },
];



export function Layout() {
  const location = useLocation();

  return (
    <div className="app-layout">
      <header className="app-header flex flex-col md:flex-row items-center justify-between px-4 py-3 md:px-8 md:py-4 border-b border-white/10 bg-card/90 backdrop-blur-md sticky top-0 z-50">
        <Link to="/" className="logo flex items-center gap-2 font-bold text-xl text-accent mb-3 md:mb-0">
          <span className="text-2xl">🪐</span>
          <span>Poemtech</span>
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
        </nav>
      </header>

      <main className="app-main flex-1 w-full max-w-7xl mx-auto px-4 py-6 md:px-8 md:py-8">
        <Outlet />
      </main>

      <footer className="app-footer border-t border-white/10 text-center py-6 px-4 text-xs md:text-sm text-muted">
        <p>모든 분석은 내 기기에서 · 영상 외부 전송 없음 🔒</p>
      </footer>
    </div>
  );
}
