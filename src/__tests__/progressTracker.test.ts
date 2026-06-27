import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { QuestionHistory, BankProgress, ProgressData } from '../types';
import {
  updateQuestionHistory,
  updateBankProgress,
  calculateMastered,
  loadProgressData,
  saveProgressData,
} from '../utils/progressTracker';

const PROGRESS_KEY = 'quiz_progress_data';

const createMockHistory = (overrides: Partial<QuestionHistory> = {}): QuestionHistory => ({
  questionId: 1,
  bankId: 'bank-1',
  totalAttempts: 0,
  correctAttempts: 0,
  lastAttemptedAt: 0,
  attempts: [],
  ...overrides,
});

const createMockBankProgress = (overrides: Partial<BankProgress> = {}): BankProgress => ({
  bankId: 'bank-1',
  totalQuestions: 10,
  answeredQuestions: 0,
  masteredQuestions: 0,
  accuracy: 0,
  lastStudiedAt: 0,
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('updateQuestionHistory', () => {
  it('should create new history entry for first attempt', () => {
    const history = updateQuestionHistory([], 1, 'bank-1', true);
    expect(history).toHaveLength(1);
    expect(history[0].questionId).toBe(1);
    expect(history[0].totalAttempts).toBe(1);
    expect(history[0].correctAttempts).toBe(1);
    expect(history[0].attempts).toHaveLength(1);
    expect(history[0].attempts[0].isCorrect).toBe(true);
  });

  it('should update existing history entry', () => {
    const existing = [createMockHistory({ questionId: 1, totalAttempts: 2, correctAttempts: 1 })];
    const history = updateQuestionHistory(existing, 1, 'bank-1', true);
    expect(history).toHaveLength(1);
    expect(history[0].totalAttempts).toBe(3);
    expect(history[0].correctAttempts).toBe(2);
  });

  it('should track incorrect attempts', () => {
    const history = updateQuestionHistory([], 1, 'bank-1', false);
    expect(history[0].correctAttempts).toBe(0);
    expect(history[0].attempts[0].isCorrect).toBe(false);
  });

  it('should limit attempts history to 20', () => {
    const existing: QuestionHistory = createMockHistory({
      questionId: 1,
      totalAttempts: 20,
      correctAttempts: 10,
      attempts: Array.from({ length: 20 }, (_, i) => ({ date: i, isCorrect: i % 2 === 0 })),
    });
    const history = updateQuestionHistory([existing], 1, 'bank-1', true);
    expect(history[0].attempts).toHaveLength(20);
    expect(history[0].totalAttempts).toBe(21);
  });
});

describe('calculateMastered', () => {
  it('should return false for new question', () => {
    const history = createMockHistory();
    expect(calculateMastered(history)).toBe(false);
  });

  it('should return false when fewer than 3 attempts', () => {
    const history = createMockHistory({
      totalAttempts: 2,
      correctAttempts: 2,
      attempts: [
        { date: 1, isCorrect: true },
        { date: 2, isCorrect: true },
      ],
    });
    expect(calculateMastered(history)).toBe(false);
  });

  it('should return true when last 3 attempts are correct', () => {
    const history = createMockHistory({
      totalAttempts: 5,
      correctAttempts: 4,
      attempts: [
        { date: 1, isCorrect: false },
        { date: 2, isCorrect: true },
        { date: 3, isCorrect: true },
        { date: 4, isCorrect: true },
        { date: 5, isCorrect: true },
      ],
    });
    expect(calculateMastered(history)).toBe(true);
  });

  it('should return false when last 3 attempts include errors', () => {
    const history = createMockHistory({
      totalAttempts: 4,
      correctAttempts: 2,
      attempts: [
        { date: 1, isCorrect: true },
        { date: 2, isCorrect: true },
        { date: 3, isCorrect: false },
        { date: 4, isCorrect: true },
      ],
    });
    expect(calculateMastered(history)).toBe(false);
  });
});

describe('updateBankProgress', () => {
  const mockQuestions = [
    { id: 1, question: 'Q1', answer: 'A', questionType: 'single' as const },
    { id: 2, question: 'Q2', answer: 'B', questionType: 'single' as const },
    { id: 3, question: 'Q3', answer: 'C', questionType: 'single' as const },
  ];

  it('should create new bank progress', () => {
    const progress = updateBankProgress([], 'bank-1', mockQuestions);
    expect(progress).toHaveLength(1);
    expect(progress[0].bankId).toBe('bank-1');
    expect(progress[0].totalQuestions).toBe(3);
    expect(progress[0].answeredQuestions).toBe(0);
  });

  it('should update answered count from history', () => {
    const history: QuestionHistory[] = [
      createMockHistory({ questionId: 1, totalAttempts: 1 }),
      createMockHistory({ questionId: 2, totalAttempts: 1 }),
    ];
    const bankProgress = updateBankProgress([], 'bank-1', mockQuestions, history);
    expect(bankProgress[0].answeredQuestions).toBe(2);
  });

  it('should calculate accuracy', () => {
    const history: QuestionHistory[] = [
      createMockHistory({ questionId: 1, totalAttempts: 2, correctAttempts: 2 }),
      createMockHistory({ questionId: 2, totalAttempts: 2, correctAttempts: 1 }),
    ];
    const bankProgress = updateBankProgress([], 'bank-1', mockQuestions, history);
    expect(bankProgress[0].accuracy).toBe(75);
  });

  it('should update existing bank progress', () => {
    const existing = [createMockBankProgress({ bankId: 'bank-1', answeredQuestions: 1 })];
    const progress = updateBankProgress(existing, 'bank-1', mockQuestions);
    expect(progress).toHaveLength(1);
    expect(progress[0].totalQuestions).toBe(3);
  });

  it('should handle empty question history', () => {
    const bankProgress = updateBankProgress([], 'bank-1', mockQuestions, []);
    expect(bankProgress[0].answeredQuestions).toBe(0);
    expect(bankProgress[0].accuracy).toBe(0);
  });
});

describe('loadProgressData and saveProgressData', () => {
  it('should return empty data when nothing saved', () => {
    const data = loadProgressData();
    expect(data.questionHistory).toEqual([]);
    expect(data.bankProgress).toEqual([]);
  });

  it('should save and load progress data', () => {
    const data: ProgressData = {
      questionHistory: [createMockHistory()],
      bankProgress: [createMockBankProgress()],
    };
    saveProgressData(data);
    const loaded = loadProgressData();
    expect(loaded.questionHistory).toHaveLength(1);
    expect(loaded.bankProgress).toHaveLength(1);
  });

  it('should handle corrupted data gracefully', () => {
    localStorage.setItem(PROGRESS_KEY, 'invalid json');
    const data = loadProgressData();
    expect(data.questionHistory).toEqual([]);
    expect(data.bankProgress).toEqual([]);
  });
});
