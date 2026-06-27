import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuiz } from '../hooks/useQuiz';
import { usePreferences } from '../context/PreferencesContext';
import { useQuestionBank } from '../hooks/useQuestionBank';
import { QUESTION_TYPE_LABELS, type QuestionType } from '../types';
import styles from './Home.module.css';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const {
    mode, setMode, questionCount, setQuestionCount, questionType, setQuestionType,
    darkMode, toggleDarkMode
  } = usePreferences();
  const {
    startQuiz, startWrongQuiz, resumeQuiz, hasSavedProgress, clearSavedProgress,
    stats, wrongQuestions, bookmarkedQuestions
  } = useQuiz();
  const { activeQuestions, activeBankName } = useQuestionBank();

  const handleStartQuiz = () => {
    startQuiz();
    navigate('/quiz');
  };

  const handleStartWrongQuiz = () => {
    startWrongQuiz();
    navigate('/quiz');
  };

  const handleResumeQuiz = () => {
    resumeQuiz();
    navigate('/quiz');
  };

  const handleDiscardProgress = () => {
    clearSavedProgress();
  };

  const totalQuestions = activeQuestions.length;

  const questionCountOptions = useMemo(() => {
    const options = [10, 20, 30, 50].filter(n => n < totalQuestions);
    if (totalQuestions > 0) options.push(totalQuestions);
    return options;
  }, [totalQuestions]);

  const availableTypes = useMemo(() => {
    const typeSet = new Set(activeQuestions.map(q => q.questionType));
    const all: { value: QuestionType | 'all'; label: string; desc: string }[] = [
      { value: 'all', label: '全部题型', desc: '综合练习' }
    ];
    const typeDescs: Record<QuestionType, string> = {
      single: '选择一个正确答案',
      multiple: '选择多个正确答案',
      judge: '判断正误',
      essay: '输入文字回答'
    };
    for (const [key, desc] of Object.entries(typeDescs) as [QuestionType, string][]) {
      if (typeSet.has(key)) {
        all.push({ value: key, label: QUESTION_TYPE_LABELS[key], desc });
      }
    }
    return all;
  }, [activeQuestions]);

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.headerTop}>
          <button className={styles.darkToggle} onClick={toggleDarkMode}>
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
        <header className={styles.header}>
          <h1 className={styles.title}>{activeBankName}</h1>
          <p className={styles.subtitle}>共{totalQuestions}道题目 · {stats.totalSessions === 0 ? '开始你的学习之旅' : `${stats.totalSessions}次答题经历`}</p>
        </header>

        <div className={styles.statsCard}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{stats.totalSessions}</span>
            <span className={styles.statLabel}>答题次数</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{stats.accuracy}%</span>
            <span className={styles.statLabel}>正确率</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{stats.correctAnswers}</span>
            <span className={styles.statLabel}>正确答案</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{wrongQuestions.length}</span>
            <span className={styles.statLabel}>错题数</span>
          </div>
        </div>
      </div>

      <div className={styles.content}>

      {totalQuestions === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📚</div>
          <h2 className={styles.emptyTitle}>还没有题库</h2>
          <p className={styles.emptyDesc}>上传 Word、PDF、TXT 等文件，或粘贴题目文本，即可开始答题</p>
          <button className={styles.emptyButton} onClick={() => navigate('/upload')}>上传题库</button>
        </div>
      ) : (
        <>
      {hasSavedProgress && (
        <div className={styles.resumeCard}>
          <div className={styles.resumeInfo}>
            <div className={styles.resumeIcon}>📋</div>
            <div className={styles.resumeText}>
              <span className={styles.resumeTitle}>有未完成的答题</span>
              <span className={styles.resumeDesc}>点击继续上次的答题进度</span>
            </div>
          </div>
          <div className={styles.resumeActions}>
            <button className={styles.resumeButton} onClick={handleResumeQuiz}>继续答题</button>
            <button className={styles.discardButton} onClick={handleDiscardProgress}>放弃</button>
          </div>
        </div>
      )}

      {wrongQuestions.length > 0 && (
        <div className={styles.wrongCard} onClick={handleStartWrongQuiz} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleStartWrongQuiz(); }}>
          <div className={styles.wrongIcon}>📝</div>
          <div className={styles.wrongInfo}>
            <span className={styles.wrongTitle}>错题集练习</span>
            <span className={styles.wrongDesc}>共{wrongQuestions.length}道错题待复习</span>
          </div>
          <div className={styles.wrongArrow}>›</div>
        </div>
      )}

      {bookmarkedQuestions.length > 0 && (
        <div className={styles.bookmarkCard} onClick={() => navigate('/stats')} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/stats'); }}>
          <div className={styles.bookmarkIcon}>⭐</div>
          <div className={styles.bookmarkInfo}>
            <span className={styles.bookmarkTitle}>我的收藏</span>
            <span className={styles.bookmarkDesc}>共{bookmarkedQuestions.length}道收藏题目</span>
          </div>
          <div className={styles.bookmarkArrow}>›</div>
        </div>
      )}

      <div className={styles.uploadCard} onClick={() => navigate('/upload')} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/upload'); }}>
        <div className={styles.uploadIcon}>📁</div>
        <div className={styles.uploadInfo}>
          <span className={styles.uploadTitle}>上传题库</span>
          <span className={styles.uploadDesc}>支持PDF、Word、图片等多种格式</span>
        </div>
        <div className={styles.uploadArrow}>›</div>
      </div>

      <div className={styles.uploadCard} onClick={() => navigate('/questions')} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/questions'); }}>
        <div className={styles.uploadIcon}>📋</div>
        <div className={styles.uploadInfo}>
          <span className={styles.uploadTitle}>查看所有题目</span>
          <span className={styles.uploadDesc}>浏览题库中的全部{totalQuestions}道题目</span>
        </div>
        <div className={styles.uploadArrow}>›</div>
      </div>

      <div className={styles.modeCard}>
        <h2 className={styles.cardTitle}>答题模式</h2>
        <div className={styles.modeList}>
          <div
            className={`${styles.modeItem} ${mode === 'sequential' ? styles.selected : ''}`}
            onClick={() => setMode('sequential')}
          >
            <div className={styles.modeInfo}>
              <span className={styles.modeName}>顺序答题</span>
              <span className={styles.modeDesc}>按题库顺序系统学习</span>
            </div>
            <div className={`${styles.modeCheck} ${mode === 'sequential' ? styles.checked : ''}`} />
          </div>
          <div
            className={`${styles.modeItem} ${mode === 'random' ? styles.selected : ''}`}    
            onClick={() => setMode('random')}
          >
            <div className={styles.modeInfo}>
              <span className={styles.modeName}>随机答题</span>
              <span className={styles.modeDesc}>随机抽取每次体验不同</span>        
            </div>
            <div className={`${styles.modeCheck} ${mode === 'random' ? styles.checked : ''}`} />
          </div>
          <div
            className={`${styles.modeItem} ${mode === 'study' ? styles.selected : ''}`}
            onClick={() => setMode('study')}
          >
            <div className={styles.modeInfo}>
              <span className={styles.modeName}>背题模式</span>
              <span className={styles.modeDesc}>直接查看答案辅助记忆</span>
            </div>
            <div className={`${styles.modeCheck} ${mode === 'study' ? styles.checked : ''}`} />
          </div>
        </div>
      </div>

      <div className={styles.typeCard}>
        <h2 className={styles.cardTitle}>题型选择</h2>
        <div className={styles.typeOptions}>
          {availableTypes.map(type => (
            <div
              key={type.value}
              className={`${styles.typeOption} ${questionType === type.value ? styles.selected : ''}`}
              onClick={() => setQuestionType(type.value)}
            >
              <span className={styles.typeLabel}>{type.label}</span>
              <span className={styles.typeDesc}>{type.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {mode !== 'study' && (
        <div className={styles.countCard}>
          <h2 className={styles.cardTitle}>题目数量</h2>
          <div className={styles.countOptions}>
            {questionCountOptions.map(count => (
              <div
                key={count}
                className={`${styles.countOption} ${questionCount === count ? styles.selected : ''}`}
                onClick={() => setQuestionCount(count)}
              >
                {count === totalQuestions ? '全部' : count}题
              </div>
            ))}
          </div>
        </div>
      )}

      {mode === 'study' && (
        <div className={styles.countCard}>
          <h2 className={styles.cardTitle}>背题数量</h2>
          <div className={styles.countInfo}>
            按所选题型包含的全部题目
          </div>
        </div>
      )}

      <div className={styles.features}>
        <h2 className={styles.cardTitle}>功能特点</h2>
        <div className={styles.featureList}>
          <span className={styles.featureTag}>实时反馈</span>
          <span className={styles.featureTag}>答案解析</span>
          <span className={styles.featureTag}>学习统计</span>
          <span className={styles.featureTag}>错题复习</span>
          <span className={styles.featureTag}>收藏题目</span>
          <span className={styles.featureTag}>断点续答</span>
          <span className={styles.featureTag}>背题模式</span>
        </div>
      </div>

        </>
      )}

      </div>

      <button className={styles.startButton} onClick={handleStartQuiz} data-testid="start-button" disabled={totalQuestions === 0}>
        {totalQuestions === 0 ? '请先上传题库' : mode === 'study' ? '开始背题' : '开始答题'}
      </button>
    </div>
  );
};

export default Home;
