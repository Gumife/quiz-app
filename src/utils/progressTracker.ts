import type { QuestionHistory, BankProgress, ProgressData, Question } from '../types';

const STORAGE_KEY = 'quiz_progress_data';
const MAX_ATTEMPTS_HISTORY = 20;
const MASTERED_THRESHOLD = 3;

export function updateQuestionHistory(
  existing: QuestionHistory[],
  questionId: number,
  bankId: string,
  isCorrect: boolean,
): QuestionHistory[] {
  const now = Date.now();
  const idx = existing.findIndex(h => h.questionId === questionId && h.bankId === bankId);

  if (idx === -1) {
    return [
      ...existing,
      {
        questionId,
        bankId,
        totalAttempts: 1,
        correctAttempts: isCorrect ? 1 : 0,
        lastAttemptedAt: now,
        attempts: [{ date: now, isCorrect }],
      },
    ];
  }

  const updated = [...existing];
  const entry = { ...updated[idx] };
  entry.totalAttempts += 1;
  if (isCorrect) entry.correctAttempts += 1;
  entry.lastAttemptedAt = now;
  entry.attempts = [...entry.attempts, { date: now, isCorrect }];
  if (entry.attempts.length > MAX_ATTEMPTS_HISTORY) {
    entry.attempts = entry.attempts.slice(entry.attempts.length - MAX_ATTEMPTS_HISTORY);
  }
  updated[idx] = entry;
  return updated;
}

export function calculateMastered(history: QuestionHistory): boolean {
  if (history.totalAttempts < MASTERED_THRESHOLD) return false;
  const recent = history.attempts.slice(-MASTERED_THRESHOLD);
  return recent.every(a => a.isCorrect);
}

export function updateBankProgress(
  existing: BankProgress[],
  bankId: string,
  questions: Question[],
  history: QuestionHistory[] = [],
): BankProgress[] {
  const totalQuestions = questions.length;
  const questionIds = new Set(questions.map(q => q.id));

  const bankHistory = history.filter(h => h.bankId === bankId && questionIds.has(h.questionId));
  const answeredQuestions = bankHistory.filter(h => h.totalAttempts > 0).length;
  const masteredQuestions = bankHistory.filter(h => calculateMastered(h)).length;

  const totalCorrect = bankHistory.reduce((sum, h) => sum + h.correctAttempts, 0);
  const totalAttempts = bankHistory.reduce((sum, h) => sum + h.totalAttempts, 0);
  const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  const idx = existing.findIndex(p => p.bankId === bankId);
  const entry: BankProgress = {
    bankId,
    totalQuestions,
    answeredQuestions,
    masteredQuestions,
    accuracy,
    lastStudiedAt: bankHistory.length > 0
      ? Math.max(...bankHistory.map(h => h.lastAttemptedAt))
      : 0,
  };

  if (idx === -1) {
    return [...existing, entry];
  }

  const updated = [...existing];
  updated[idx] = entry;
  return updated;
}

export function loadProgressData(): ProgressData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { questionHistory: [], bankProgress: [] };
    const parsed = JSON.parse(stored);
    if (
      parsed &&
      Array.isArray(parsed.questionHistory) &&
      Array.isArray(parsed.bankProgress)
    ) {
      return parsed;
    }
    return { questionHistory: [], bankProgress: [] };
  } catch {
    return { questionHistory: [], bankProgress: [] };
  }
}

export function saveProgressData(data: ProgressData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
