import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuestionBank } from '../hooks/useQuestionBank';
import QuestionImage from '../components/QuestionImage';
import FormulaText from '../components/FormulaText';
import { QUESTION_TYPE_SHORT_LABELS, type QuestionType } from '../types';
import styles from './QuestionList.module.css';


const QuestionList: React.FC = () => {
  const navigate = useNavigate();
  const { activeQuestions } = useQuestionBank();
  const [filterType, setFilterType] = useState<QuestionType | 'all'>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filteredQuestions = filterType === 'all'
    ? activeQuestions
    : activeQuestions.filter(q => q.questionType === filterType);

  const typeCounts = activeQuestions.reduce((acc, q) => {
    acc[q.questionType] = (acc[q.questionType] || 0) + 1;
    return acc;
  }, {} as Record<QuestionType, number>);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/')}>← 返回</button>
        <h1 className={styles.title}>题目列表</h1>
        <span className={styles.count}>{filteredQuestions.length} 题</span>
      </header>

      <div className={styles.filters}>
        <button
          className={`${styles.filterBtn} ${filterType === 'all' ? styles.active : ''}`}
          onClick={() => setFilterType('all')}
        >
          全部 ({activeQuestions.length})
        </button>
        {Object.entries(typeCounts).map(([type, count]) => (
          <button
            key={type}
            className={`${styles.filterBtn} ${filterType === type ? styles.active : ''}`}
            onClick={() => setFilterType(type as QuestionType)}
          >
            {QUESTION_TYPE_SHORT_LABELS[type as QuestionType]} ({count})
          </button>
        ))}
      </div>

      <div className={styles.questionList}>
        {filteredQuestions.map((question, index) => (
          <div
            key={question.id}
            className={`${styles.questionCard} ${expandedId === question.id ? styles.expanded : ''}`}
            onClick={() => setExpandedId(expandedId === question.id ? null : question.id)}
          >
            <div className={styles.questionHeader}>
              <span className={styles.questionNumber}>#{index + 1}</span>
              <span className={`${styles.typeTag} ${styles[question.questionType]}`}>
                {QUESTION_TYPE_SHORT_LABELS[question.questionType]}
              </span>
              <span className={styles.expandIcon}>{expandedId === question.id ? '−' : '+'}</span>
            </div>
            
            <div className={styles.questionText}>
              <FormulaText text={question.question} />
            </div>

            {expandedId === question.id && (
              <div className={styles.questionDetails}>
                {question.questionImage && (
                  <QuestionImage src={question.questionImage} alt="题目图片" />
                )}
                
                {question.options && question.options.length > 0 && (
                  <div className={styles.options}>
                    {question.options.map(opt => (
                      <div key={opt.key} className={styles.option}>
                        <span className={styles.optionKey}>{opt.key}</span>
                        <span className={styles.optionText}>
                          <FormulaText text={opt.text} />
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className={styles.answer}>
                  <strong>答案：</strong>
                  {Array.isArray(question.answer) ? question.answer.join('') : question.answer}
                </div>

                {question.explanation && (
                  <div className={styles.explanation}>
                    <strong>解析：</strong>{question.explanation}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <button className={styles.backButton} onClick={() => navigate('/')}>返回首页</button>
    </div>
  );
};

export default QuestionList;
