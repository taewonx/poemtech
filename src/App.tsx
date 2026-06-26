import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout/Layout';
import { PoseAnalysis } from './pages/PoseAnalysis';
import { Feedback } from './pages/Feedback';
import { Home } from './pages/Home';
import { initGA } from './utils/analytics';
import { AnalyticsTracker } from './components/Analytics/AnalyticsTracker';
import './index.css';

function App() {
  useEffect(() => {
    initGA();
  }, []);

  return (
    <BrowserRouter>
      <AnalyticsTracker />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="analysis" element={<PoseAnalysis />} />
          <Route path="feedback" element={<Feedback />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
