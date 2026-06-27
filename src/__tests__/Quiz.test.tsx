import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { PreferencesProvider } from '../context/PreferencesContext';
import { QuizProvider } from '../context/QuizContext';
import { QuestionBankProvider } from '../context/QuestionBankContext';
import { useQuiz } from '../hooks/useQuiz';
import Quiz from '../pages/Quiz';
import type { Question } from '../types';

const singleOnly: Question[] = [
  { id: 1, question: '单选题1', options: [{ key: 'A', text: '选项A' }, { key: 'B', text: '选项B' }], answer: 'A', questionType: 'single' },
  { id: 2, question: '单选题2', options: [{ key: 'A', text: '选项A' }, { key: 'B', text: '选项B' }], answer: 'B', questionType: 'single' },
];

const multipleOnly: Question[] = [
  { id: 3, question: '多选题1', options: [{ key: 'A', text: '选项A' }, { key: 'B', text: '选项B' }, { key: 'C', text: '选项C' }], answer: ['A', 'C'], questionType: 'multiple' },
];

const setupBank = (questions: Question[]) => {
  const bankId = 'test-bank-' + Date.now();
  localStorage.setItem('question_banks', JSON.stringify([{ id: bankId, name: '测试题库', source: 'test', questions, createdAt: Date.now() }]));
  localStorage.setItem('active_bank', bankId);
};

// Wrapper that auto-starts the quiz
function AutoStartQuiz({ children }: { children: ReactNode }) {
  const { currentSession, startQuiz } = useQuiz();
  if (!currentSession) {
    startQuiz();
  }
  return <>{children}</>;
}

function renderQuiz(questions: Question[]) {
  setupBank(questions);
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <PreferencesProvider>
        <QuestionBankProvider>
          <QuizProvider>
            <AutoStartQuiz>
              <Quiz />
            </AutoStartQuiz>
          </QuizProvider>
        </QuestionBankProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );
}

describe('Quiz Page', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should redirect to home when no session', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PreferencesProvider>
          <QuestionBankProvider>
            <QuizProvider>
              <Quiz />
            </QuizProvider>
          </QuestionBankProvider>
        </PreferencesProvider>
      </MemoryRouter>
    );
    expect(window.location.pathname).toBe('/');
  });

  it('should render quiz with question text', () => {
    renderQuiz(singleOnly);
    expect(screen.getByTestId('question-text')).toHaveTextContent('单选题1');
  });

  it('should display options for single-choice question', () => {
    renderQuiz(singleOnly);
    const options = screen.getAllByTestId('quiz-option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('A');
    expect(options[0]).toHaveTextContent('选项A');
  });

  it('should select option on click and show correct feedback', () => {
    renderQuiz(singleOnly);
    const options = screen.getAllByTestId('quiz-option');
    fireEvent.click(options[0]); // Click option A (correct)
    expect(screen.getByTestId('feedback')).toHaveTextContent('回答正确');
  });

  it('should show wrong feedback for incorrect single-choice answer', () => {
    renderQuiz(singleOnly);
    const options = screen.getAllByTestId('quiz-option');
    fireEvent.click(options[1]); // Click option B (wrong, answer is A)
    expect(screen.getByTestId('feedback')).toHaveTextContent('回答错误');
  });

  it('should select answer with keyboard shortcut A', () => {
    renderQuiz(singleOnly);
    act(() => {
      fireEvent.keyDown(window, { key: 'a' });
    });
    expect(screen.getByTestId('feedback')).toHaveTextContent('回答正确');
  });

  it('should select answer with keyboard shortcut B', () => {
    renderQuiz(singleOnly);
    act(() => {
      fireEvent.keyDown(window, { key: 'b' });
    });
    expect(screen.getByTestId('feedback')).toHaveTextContent('回答错误');
  });

  it('should not select answer with keyboard after already answered', () => {
    renderQuiz(singleOnly);
    act(() => {
      fireEvent.keyDown(window, { key: 'a' });
    });
    expect(screen.getByTestId('feedback')).toHaveTextContent('回答正确');

    // Try to answer again - should not change
    act(() => {
      fireEvent.keyDown(window, { key: 'b' });
    });
    expect(screen.getByTestId('feedback')).toHaveTextContent('回答正确');
  });

  it('should display progress info', () => {
    renderQuiz(singleOnly);
    const progressInfo = screen.getByTestId('progress-info');
    expect(progressInfo).toHaveTextContent('1');
    expect(progressInfo).toHaveTextContent('/2');
  });

  it('should show multi-choice tip for multiple choice questions', () => {
    renderQuiz(multipleOnly);
    expect(screen.getByText('请选择所有正确答案')).toBeInTheDocument();
  });

  it('should toggle multi-choice selection on click', () => {
    renderQuiz(multipleOnly);
    const options = screen.getAllByTestId('quiz-option');
    fireEvent.click(options[0]); // Select A
    expect(options[0]).toHaveTextContent('✓'); // Should show checkmark

    fireEvent.click(options[0]); // Deselect A
    expect(options[0]).not.toHaveTextContent('✓');
  });

  it('should submit multiple choice with Enter key', () => {
    renderQuiz(multipleOnly);
    const options = screen.getAllByTestId('quiz-option');
    fireEvent.click(options[0]); // Select A
    fireEvent.click(options[2]); // Select C (correct answer is A,C)

    // Press Enter to submit
    act(() => {
      fireEvent.keyDown(window, { key: 'Enter' });
    });
    expect(screen.getByTestId('feedback')).toHaveTextContent('回答正确');
  });

  it('should navigate to next question with Enter after answering', () => {
    renderQuiz(singleOnly);
    act(() => {
      fireEvent.keyDown(window, { key: 'a' }); // Answer Q1
    });
    expect(screen.getByTestId('feedback')).toHaveTextContent('回答正确');

    // Press Enter to go to next question
    act(() => {
      fireEvent.keyDown(window, { key: 'Enter' });
    });
    expect(screen.getByTestId('question-text')).toHaveTextContent('单选题2');
  });

  it('should show study mode indicator', () => {
    // Set study mode in localStorage
    localStorage.setItem('quiz_mode', 'study');
    renderQuiz(singleOnly);
    expect(screen.getByText('背题模式')).toBeInTheDocument();
  });
});
