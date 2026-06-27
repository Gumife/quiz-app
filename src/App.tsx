import { lazy, Suspense, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { PreferencesProvider, usePreferences } from './context/PreferencesContext';
import { QuizProvider } from './context/QuizContext';
import { QuestionBankProvider } from './context/QuestionBankContext';
import './App.css';

const Home = lazy(() => import('./pages/Home'));
const Quiz = lazy(() => import('./pages/Quiz'));
const Result = lazy(() => import('./pages/Result'));
const Stats = lazy(() => import('./pages/Stats'));
const Upload = lazy(() => import('./pages/Upload'));
const QuestionList = lazy(() => import('./pages/QuestionList'));

import Loading from './components/Loading';

function GlowBackground() {
  const { darkMode } = usePreferences();
  const orbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const handleMove = (e: MouseEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const dx = (e.clientX / window.innerWidth - 0.5) * 2;
        const dy = (e.clientY / window.innerHeight - 0.5) * 2;
        const max = 24;
        if (orbRef.current) {
          orbRef.current.style.transform = `translate(${dx * max}px, ${dy * max}px)`;
        }
      });
    };
    window.addEventListener('mousemove', handleMove);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  const glowColor = darkMode ? 'rgba(129, 140, 248, 0.38)' : 'rgba(217, 119, 6, 0.30)';
  const glowColor2 = darkMode ? 'rgba(99, 102, 241, 0.30)' : 'rgba(245, 158, 11, 0.22)';

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }} aria-hidden="true">
      <div
        ref={orbRef}
        className="glow-orb"
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: '90vmin',
          height: '90vmin',
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          opacity: 0.7,
          filter: 'blur(48px)',
          background: `radial-gradient(circle at center, ${glowColor} 0%, transparent 70%)`,
          transition: 'background 0.6s ease',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '18%',
          width: '60vmin',
          height: '60vmin',
          transform: 'translateX(-50%)',
          borderRadius: '50%',
          opacity: 0.6,
          filter: 'blur(48px)',
          background: `radial-gradient(circle at center, ${glowColor2} 0%, transparent 72%)`,
          transition: 'background 0.6s ease',
        }}
      />
    </div>
  );
}

function App() {
  return (
    <PreferencesProvider>
      <QuestionBankProvider>
        <QuizProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <GlowBackground />
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/quiz" element={<Quiz />} />
                <Route path="/result" element={<Result />} />
                <Route path="/stats" element={<Stats />} />
                <Route path="/upload" element={<Upload />} />
                <Route path="/questions" element={<QuestionList />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </Router>
        </QuizProvider>
      </QuestionBankProvider>
    </PreferencesProvider>
  );
}

export default App;
