import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuiz } from '../hooks/useQuiz';
import styles from './Result.module.css';

const CONFETTI_COUNT = 100;
const CONFETTI_COLORS = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd', '#01a3a4'];

const createConfetti = () => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;overflow:hidden;';
  document.body.appendChild(container);

  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const confetti = document.createElement('div');
    const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    const left = Math.random() * 100;
    const delay = Math.random() * 0.5;
    const duration = 2 + Math.random() * 2;
    const size = 8 + Math.random() * 8;

    confetti.style.cssText = `
      position: absolute;
      top: -20px;
      left: ${left}%;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      animation: confettiFall ${duration}s ease-in ${delay}s forwards;
    `;
    container.appendChild(confetti);
  }

  const timer = setTimeout(() => container.remove(), 5000);
  return () => {
    clearTimeout(timer);
    container.remove();
  };
};

const Result: React.FC = () => {
  const navigate = useNavigate();
  const { currentSession, startQuiz } = useQuiz();

  const score = currentSession?.score ?? 0;
  const total = currentSession?.totalQuestions ?? 0;
  const accuracy = total > 0 ? Math.round((score / total) * 100) : 0;

  useEffect(() => {
    if (!currentSession) {
      navigate('/');
    } else if (accuracy === 100 && currentSession.answers.length > 0) {
      return createConfetti();
    }
  }, [accuracy, currentSession, navigate]);

  if (!currentSession) {
    return null;
  }

  const getRating = () => {
    if (accuracy >= 90) return { icon: '🏆', text: '优秀', desc: '太棒了！你的安全知识非常扎实', color: '#FFD700' };
    if (accuracy >= 70) return { icon: '👍', text: '良好', desc: '不错，继续努力，争取更高分数', color: '#00b42a' };
    if (accuracy >= 60) return { icon: '💪', text: '及格', desc: '还需要多加练习哦', color: '#165dff' };
    return { icon: '📚', text: '需加强', desc: '建议多学习安全知识，再来挑战', color: '#ff7a45' };
  };

  const rating = getRating();

  const handleRestart = () => {
    startQuiz();
    navigate('/quiz');
  };

  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <div className={styles.container}>
      <div className={styles.resultCard}>
        <div className={styles.ratingBadge} style={{ background: rating.color }}>
          <span className={styles.ratingIcon}>{rating.icon}</span>
        </div>
        <h2 className={styles.ratingText}>{rating.text}</h2>
        <p className={styles.ratingDesc}>{rating.desc}</p>
      </div>

      <div className={styles.scoreCard}>
        <div className={styles.scoreMain}>
          <span className={styles.scoreValue} data-testid="score-value">{score}</span>
          <span className={styles.scoreDivider}>/</span>
          <span className={styles.scoreTotal}>{total}</span>
        </div>
        <p className={styles.scoreLabel}>本次得分</p>
        <div className={styles.accuracyRing}>
          <div
            className={styles.accuracyFill}
            style={{
              background: `conic-gradient(${rating.color} ${accuracy}%, #e5e6eb 0%)`        
            }}
          >
            <div className={styles.accuracyInner}>
              <span className={styles.accuracyValue}>{accuracy}%</span>
              <span className={styles.accuracyLabel}>正确率</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{total - score}</span>
          <span className={styles.statLabel}>错误数</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{currentSession.answers.length}</span>
          <span className={styles.statLabel}>已答题数</span>
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.primaryButton} onClick={handleRestart}>
          再答一次
        </button>
        <button className={styles.secondaryButton} onClick={handleGoHome}>
          返回首页
        </button>
      </div>
    </div>
  );
};

export default Result;
