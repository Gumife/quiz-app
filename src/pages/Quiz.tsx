import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuiz } from '../hooks/useQuiz';
import { usePreferences } from '../context/PreferencesContext';
import QuestionImage from '../components/QuestionImage';
import FormulaText from '../components/FormulaText';
import AnswerCard from '../components/AnswerCard';
import { QUESTION_TYPE_LABELS } from '../types';
import styles from './Quiz.module.css';

const Quiz: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentSession, currentQuestion, currentQuestionIndex, selectedAnswer,
    hasAnswered, isCorrect, selectAnswer, submitMultipleAnswer, nextQuestion,
    previousQuestion, jumpToQuestion, toggleBookmark, isBookmarked, sessionQuestions
  } = useQuiz();
  const { soundEnabled, toggleSound } = usePreferences();

  const [essayInput, setEssayInput] = useState('');
  const [showAnswerCard, setShowAnswerCard] = useState(false);

  const progress = currentSession ? ((currentQuestionIndex + 1) / currentSession.totalQuestions) * 100 : 0;
  const isStudyMode = currentSession?.mode === 'study';
  const isLastQuestion = currentSession ? currentQuestionIndex >= currentSession.totalQuestions - 1 : false;
  const isMultiple = currentQuestion?.questionType === 'multiple';
  const bookmarked = currentQuestion ? isBookmarked(currentQuestion.id) : false;

  const goNext = useCallback(() => {
    nextQuestion();
    window.scrollTo(0, 0);
    if (isLastQuestion) navigate('/result');
  }, [isLastQuestion, nextQuestion, navigate]);

  const handlePrevious = useCallback(() => {
    previousQuestion();
    window.scrollTo(0, 0);
  }, [previousQuestion]);

  const handleJumpToQuestion = useCallback((index: number) => {
    jumpToQuestion(index);
    window.scrollTo(0, 0);
  }, [jumpToQuestion]);

  useEffect(() => {
    if (!currentQuestion) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (essayInput !== '' || document.activeElement?.tagName === 'TEXTAREA') return;

      const key = e.key.toUpperCase();
      if (['A', 'B', 'C', 'D'].includes(key) && !hasAnswered && !isStudyMode) {
        const option = currentQuestion.options?.find(o => o.key.toUpperCase() === key);
        if (option) selectAnswer(option.key);
    } else if (key === 'ENTER') {
      if (hasAnswered || isStudyMode) {
        goNext();
      } else if (isMultiple && selectedAnswer && Array.isArray(selectedAnswer) && selectedAnswer.length > 0) {
        submitMultipleAnswer();
      }
    }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasAnswered, isStudyMode, currentQuestion, selectAnswer, goNext, submitMultipleAnswer, selectedAnswer, isMultiple, essayInput]);

  useEffect(() => {
    if (!currentSession || !currentQuestion) {
      navigate('/');
    }
  }, [currentSession, currentQuestion, navigate]);

  if (!currentSession || !currentQuestion) {
    return null;
  }

  const getOptionClass = (optionKey: string) => {
    const classes = [styles.option];

    if (hasAnswered || isStudyMode) {
      const correctAnswers = Array.isArray(currentQuestion.answer)
        ? currentQuestion.answer
        : [currentQuestion.answer];
      const selectedAnswers = Array.isArray(selectedAnswer)
        ? selectedAnswer
        : selectedAnswer ? [selectedAnswer] : [];

      if (correctAnswers.includes(optionKey)) {
        classes.push(styles.correct);
      } else if (selectedAnswers.includes(optionKey) && !isCorrect) {
        classes.push(styles.wrong);
      }
    } else {
      if (isMultiple) {
        const selectedAnswers = Array.isArray(selectedAnswer) ? selectedAnswer : [];        
        if (selectedAnswers.includes(optionKey)) {
          classes.push(styles.selected);
        }
      } else if (optionKey === selectedAnswer) {
        classes.push(styles.selected);
      }
    }

    return classes.join(' ');
  };

  const getQuestionTypeLabel = () => {
    return QUESTION_TYPE_LABELS[currentQuestion.questionType] || '单选题';
  };

  const getExplanation = () => {
    if (currentQuestion.questionType === 'essay') {
      return `参考答案：${currentQuestion.answer}`;
    }

    const correctOption = currentQuestion.options?.find((o: { key: string; text: string }) => {
      const correctAnswers = Array.isArray(currentQuestion.answer)
        ? currentQuestion.answer
        : [currentQuestion.answer];
      return correctAnswers.includes(o.key);
    });

    if (isCorrect) {
      return `回答正确：${correctOption?.text}`;
    }

    const correctAnswers = Array.isArray(currentQuestion.answer)
      ? currentQuestion.answer.join('、')
      : currentQuestion.answer;
    return `正确答案是：${correctAnswers}，${correctOption?.text}`;
  };

  const handleEssaySubmit = () => {
    selectAnswer(essayInput);
    setEssayInput('');
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.progressTop}>
          <button className={styles.backBtn} onClick={() => navigate('/')}>← 返回</button>
          <div className={styles.headerRight}>
            <button className={styles.gridBtn} onClick={() => setShowAnswerCard(true)}>
              ⊞
            </button>
            <button className={`${styles.soundBtn} ${soundEnabled ? styles.soundOn : ''}`} onClick={toggleSound}>
              {soundEnabled ? '🔊' : '🔇'}
            </button>
            {isStudyMode && <span className={styles.studyMode}>背题模式</span>}
          </div>
        </div>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
        <div className={styles.progressInfo} data-testid="progress-info">
          <span className={styles.currentNum}>{currentQuestionIndex + 1}</span>
          <span className={styles.totalNum}>/{currentSession.totalQuestions}</span>
          {!isStudyMode && <span className={styles.score}>得分: {currentSession.score}</span>}
        </div>
      </header>

      <div className={styles.questionCard}>
        <div className={styles.questionHeader}>
          <span className={styles.questionType}>{getQuestionTypeLabel()}</span>
          <button 
            className={`${styles.bookmarkBtn} ${bookmarked ? styles.bookmarked : ''}`}
            onClick={() => toggleBookmark(currentQuestion)}
          >
            {bookmarked ? '⭐' : '☆'}
          </button>
        </div>
        <p className={styles.questionText} data-testid="question-text">
          <FormulaText text={currentQuestion.question} />
        </p>
        {currentQuestion.questionImage && (
          <QuestionImage src={currentQuestion.questionImage} alt="题目图片" />
        )}
        {isMultiple && !hasAnswered && (
          <p className={styles.tip}>请选择所有正确答案</p>
        )}
      </div>

      {currentQuestion.questionType === 'essay' ? (
        <div className={styles.essaySection}>
          {isStudyMode || hasAnswered ? (
            <div className={`${styles.feedback} ${styles.feedbackEssay}`}>
              <div className={styles.feedbackIcon}>📝</div>
              <div className={styles.feedbackContent}>
                <div className={styles.feedbackTitle}>参考答案</div>
                <div className={styles.feedbackText}>
                  <FormulaText text={String(currentQuestion.answer)} />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <textarea
                className={styles.essayInput}
                value={essayInput}
                onChange={(e) => setEssayInput(e.target.value)}
                placeholder="请输入你的答案..."
                rows={6}
              />
              <button
                className={`${styles.button} ${essayInput.trim() ? styles.primaryButton : styles.disabledButton}`}
                onClick={handleEssaySubmit}
                disabled={!essayInput.trim()}
              >
                提交答案
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.optionsList}>
          {currentQuestion.options?.map((option: { key: string; text: string }) => (
            <div
              key={option.key}
              className={getOptionClass(option.key)}
              data-testid="quiz-option"
              role={!isStudyMode && !hasAnswered ? 'button' : undefined}
              tabIndex={!isStudyMode && !hasAnswered ? 0 : undefined}
              onClick={!isStudyMode && !hasAnswered ? () => selectAnswer(option.key) : undefined}
              onKeyDown={!isStudyMode && !hasAnswered ? (e) => { if (e.key === 'Enter' || e.key === ' ') selectAnswer(option.key); } : undefined}
            >
              <span className={styles.optionKey}>
                {isMultiple && Array.isArray(selectedAnswer) && selectedAnswer.includes(option.key) ? '✓' : option.key}
              </span>
              <span className={styles.optionText}>
                <FormulaText text={option.text} />
              </span>
              {currentQuestion.optionImages?.find(oi => oi.key === option.key) && (
                <QuestionImage
                  src={currentQuestion.optionImages.find(oi => oi.key === option.key)!.image}
                  alt={`选项${option.key}图片`}
                  className={styles.optionImage}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {(isStudyMode || (hasAnswered && selectedAnswer)) && currentQuestion.questionType !== 'essay' && (
        <div className={`${styles.feedback} ${isStudyMode ? styles.feedbackStudy : isCorrect ? styles.feedbackCorrect : styles.feedbackWrong}`} data-testid="feedback">
          <div className={styles.feedbackIcon}>
            {isStudyMode ? '📖' : isCorrect ? '✓' : '✗'}
          </div>
          <div className={styles.feedbackContent}>
            <div className={styles.feedbackTitle}>
              {isStudyMode ? '答案解析' : isCorrect ? '回答正确' : '回答错误'}
            </div>
            <div className={styles.feedbackText}>
              <FormulaText text={getExplanation()} />
            </div>
            {currentQuestion.answerImage && (
              <QuestionImage src={currentQuestion.answerImage} alt="答案解析图片" />
            )}
          </div>
        </div>
      )}

      <div className={styles.actions}>
        <button
          className={`${styles.button} ${styles.secondaryButton}`}
          onClick={handlePrevious}
          disabled={currentQuestionIndex === 0}
        >
          上一题
        </button>
        {isStudyMode ? (
          <button
            className={`${styles.button} ${styles.primaryButton}`}
            onClick={goNext}
          >
            {isLastQuestion ? '完成背题' : '下一题'}
          </button>
        ) : currentQuestion.questionType === 'essay' && hasAnswered ? (
          <button
            className={`${styles.button} ${styles.primaryButton}`}
            onClick={goNext}
          >
            {isLastQuestion ? '查看结果' : '下一题'}
          </button>
        ) : isMultiple && !hasAnswered ? (
          <button
            className={`${styles.button} ${selectedAnswer && Array.isArray(selectedAnswer) && selectedAnswer.length > 0 ? styles.primaryButton : styles.disabledButton}`}
            onClick={submitMultipleAnswer}
            disabled={!selectedAnswer || (Array.isArray(selectedAnswer) && selectedAnswer.length === 0)}
          >
            提交答案
          </button>
        ) : (
          <button
            className={`${styles.button} ${hasAnswered ? styles.primaryButton : styles.disabledButton}`}
            onClick={goNext}
            disabled={!hasAnswered}
          >
            {isLastQuestion ? '查看结果' : '下一题'}
          </button>
        )}
      </div>

      {showAnswerCard && currentSession && (
        <AnswerCard
          questions={sessionQuestions}
          answers={currentSession.answers}
          currentIndex={currentQuestionIndex}
          onSelect={handleJumpToQuestion}
          onClose={() => setShowAnswerCard(false)}
        />
      )}
    </div>
  );
};

export default Quiz;
