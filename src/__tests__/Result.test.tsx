import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { PreferencesProvider } from '../context/PreferencesContext';
import { QuizProvider } from '../context/QuizContext';
import { QuestionBankProvider } from '../context/QuestionBankContext';
import { useQuiz } from '../hooks/useQuiz';
import Result from '../pages/Result';
import type { Question } from '../types';

const sampleQuestions: Question[] = [
  { id: 1, question: '题目1', options: [{ key: 'A', text: '选项A' }, { key: 'B', text: '选项B' }], answer: 'A', questionType: 'single' },
  { id: 2, question: '题目2', options: [{ key: 'A', text: '选项A' }, { key: 'B', text: '选项B' }], answer: 'B', questionType: 'single' },
  { id: 3, question: '题目3', options: [{ key: 'A', text: '选项A' }, { key: 'B', text: '选项B' }], answer: 'A', questionType: 'single' },
  { id: 4, question: '题目4', options: [{ key: 'A', text: '选项A' }, { key: 'B', text: '选项B' }], answer: 'B', questionType: 'single' },
  { id: 5, question: '题目5', options: [{ key: 'A', text: '选项A' }, { key: 'B', text: '选项B' }], answer: 'A', questionType: 'single' },
];

const setupBank = (questions: Question[]) => {
  const bankId = 'test-bank-' + Date.now();
  localStorage.setItem('question_banks', JSON.stringify([{ id: bankId, name: '测试题库', source: 'test', questions, createdAt: Date.now() }]));
  localStorage.setItem('active_bank', bankId);
};

/* eslint-disable react-hooks/set-state-in-effect */
function QuizRunner({ questions, correctIndices }: { questions: Question[]; correctIndices: number[] }) {
  const { currentSession, startQuiz, selectAnswer, nextQuestion, hasAnswered } = useQuiz();
  const [step, setStep] = useState<'init' | 'answer' | 'advance' | 'done'>('init');

  const getAnswerKey = useCallback((q: Question, idx: number) => {
    const correct = correctIndices.includes(idx);
    const correctKey = q.answer as string;
    return correct ? correctKey : q.options!.find(o => o.key !== correctKey)!.key;
  }, [correctIndices]);

  useEffect(() => {
    if (step === 'init' && !currentSession) {
      startQuiz();
      setStep('answer');
    }
  }, [step, currentSession, startQuiz]);

  useEffect(() => {
    if (step !== 'answer' || !currentSession || currentSession.endTime) return;
    const idx = currentSession.answers.length;
    if (idx >= questions.length) {
      setStep('done');
      return;
    }
    selectAnswer(getAnswerKey(questions[idx], idx));
    setStep('advance');
  }, [step, currentSession, questions, getAnswerKey, selectAnswer]);

  useEffect(() => {
    if (step !== 'advance' || !hasAnswered) return;
    nextQuestion();
    setStep('answer');
  }, [step, hasAnswered, nextQuestion]);

  if (currentSession?.endTime) {
    return <Result />;
  }

  return <div>Running quiz...</div>;
}

function renderResult(questions: Question[], correctIndices: number[]) {
  setupBank(questions);
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <PreferencesProvider>
        <QuestionBankProvider>
          <QuizProvider>
            <Routes>
              <Route path="/" element={<QuizRunner questions={questions} correctIndices={correctIndices} />} />
              <Route path="/quiz" element={<div data-testid="quiz-page">Quiz Page</div>} />
            </Routes>
          </QuizProvider>
        </QuestionBankProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );
}

describe('Result Page', () => {
  beforeEach(() => {
    localStorage.clear();
    if (!window.matchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }),
      });
    }
  });

  it('should redirect to home when no session', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PreferencesProvider>
          <QuestionBankProvider>
            <QuizProvider>
              <Result />
            </QuizProvider>
          </QuestionBankProvider>
        </PreferencesProvider>
      </MemoryRouter>
    );
    expect(window.location.pathname).toBe('/');
  });

  it('should display score correctly (3/5)', async () => {
    await act(async () => {
      renderResult(sampleQuestions.slice(0, 5), [0, 1, 2]);
    });
    await waitFor(() => {
      expect(screen.getByTestId('score-value')).toHaveTextContent('3');
    });
  });

  it('should show excellent rating for 100% accuracy', async () => {
    await act(async () => {
      renderResult(sampleQuestions.slice(0, 5), [0, 1, 2, 3, 4]);
    });
    await waitFor(() => {
      expect(screen.getByText('优秀')).toBeInTheDocument();
    });
  });

  it('should show good rating for 80% accuracy', async () => {
    await act(async () => {
      renderResult(sampleQuestions.slice(0, 5), [0, 1, 2, 3]);
    });
    await waitFor(() => {
      expect(screen.getByText('良好')).toBeInTheDocument();
    });
  });

  it('should show pass rating for 60% accuracy', async () => {
    await act(async () => {
      renderResult(sampleQuestions.slice(0, 5), [0, 1, 2]);
    });
    await waitFor(() => {
      expect(screen.getByText('及格')).toBeInTheDocument();
    });
  });

  it('should show fail rating for 40% accuracy', async () => {
    await act(async () => {
      renderResult(sampleQuestions.slice(0, 5), [0, 1]);
    });
    await waitFor(() => {
      expect(screen.getByText('需加强')).toBeInTheDocument();
    });
  });

  it('should display accuracy percentage', async () => {
    await act(async () => {
      renderResult(sampleQuestions.slice(0, 5), [0, 1, 2]);
    });
    await waitFor(() => {
      expect(screen.getByText('60%')).toBeInTheDocument();
    });
  });

  it('should display wrong count', async () => {
    await act(async () => {
      renderResult(sampleQuestions.slice(0, 3), [0]);
    });
    await waitFor(() => {
      const wrongLabel = screen.getByText('错误数');
      const wrongCard = wrongLabel.closest('div');
      expect(wrongCard?.textContent).toContain('2');
    });
  });

  it('should have restart button', async () => {
    await act(async () => {
      renderResult(sampleQuestions.slice(0, 3), [0]);
    });
    await waitFor(() => {
      expect(screen.getByText('再答一次')).toBeInTheDocument();
    });
  });

  it('should have go home button', async () => {
    await act(async () => {
      renderResult(sampleQuestions.slice(0, 3), [0]);
    });
    await waitFor(() => {
      expect(screen.getByText('返回首页')).toBeInTheDocument();
    });
  });

  it('should show zero score when all wrong', async () => {
    await act(async () => {
      renderResult(sampleQuestions.slice(0, 3), []);
    });
    await waitFor(() => {
      expect(screen.getByTestId('score-value')).toHaveTextContent('0');
      expect(screen.getByText('0%')).toBeInTheDocument();
    });
  });

  it('should show quiz page after restart click', async () => {
    await act(async () => {
      renderResult(sampleQuestions.slice(0, 3), [0]);
    });
    await waitFor(() => {
      expect(screen.getByText('再答一次')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('再答一次'));
    await waitFor(() => {
      expect(screen.getByTestId('quiz-page')).toBeInTheDocument();
    });
  });
});
