import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Question, UserAnswer } from '../types';
import styles from './AnswerCard.module.css';

interface AnswerCardProps {
  questions: Question[];
  answers: UserAnswer[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}

const AnswerCard: React.FC<AnswerCardProps> = ({
  questions,
  answers,
  currentIndex,
  onSelect,
  onClose,
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const answerMap = useMemo(() => {
    const map = new Map<number, UserAnswer>();
    for (const answer of answers) {
      map.set(answer.questionId, answer);
    }
    return map;
  }, [answers]);

  const stats = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    for (const answer of answers) {
      if (answer.isCorrect === true) correct++;
      else if (answer.isCorrect === false) wrong++;
    }
    return { answered: answers.length, correct, wrong, unanswered: questions.length - answers.length };
  }, [answers, questions.length]);

  const getQuestionStatus = useCallback((questionId: number, index: number): string => {
    if (index === currentIndex) return styles.current;
    const answer = answerMap.get(questionId);
    if (!answer) return styles.unanswered;
    if (answer.isCorrect === true) return styles.correct;
    if (answer.isCorrect === false) return styles.wrong;
    return styles.unanswered;
  }, [answerMap, currentIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const currentCell = cellRefs.current[currentIndex];
    if (currentCell && gridRef.current) {
      currentCell.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentIndex]);

  const handleCellClick = useCallback((index: number) => {
    onSelect(index);
    onClose();
  }, [onSelect, onClose]);

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-label="答题卡">
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>答题卡</h3>
          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <span className={`${styles.dot} ${styles.correct}`} /> 答对
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.dot} ${styles.wrong}`} /> 答错
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.dot} ${styles.unanswered}`} /> 未答
            </span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="关闭答题卡">✕</button>
        </div>
        <div className={styles.grid} ref={gridRef}>
          {questions.map((q, index) => {
            const status = getQuestionStatus(q.id, index);
            const answer = answerMap.get(q.id);
            const ariaLabel = `第 ${index + 1} 题${answer ? (answer.isCorrect ? '，已答对' : '，已答错') : '，未作答'}`;
            return (
              <button
                key={q.id}
                ref={(el) => { cellRefs.current[index] = el; }}
                className={`${styles.cell} ${status}`}
                onClick={() => handleCellClick(index)}
                aria-label={ariaLabel}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
        <div className={styles.footer}>
          <span>共 {questions.length} 题</span>
          <span>已答 {stats.answered} 题</span>
          <span>正确 {stats.correct} 题</span>
        </div>
      </div>
    </div>
  );
};

export default AnswerCard;
