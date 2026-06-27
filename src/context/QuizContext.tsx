import React, { createContext, useState, useEffect, useContext, useMemo, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Question, UserAnswer, QuizSession, QuizStats } from '../types';
import QuestionBankContext from './QuestionBankContext';
import { usePreferences } from './PreferencesContext';

interface QuizContextType {
  currentSession: QuizSession | null;
  currentQuestionIndex: number;
  currentQuestion: Question | null;
  selectedAnswer: string | string[] | null;
  hasAnswered: boolean;
  isCorrect: boolean | null;
  stats: QuizStats;
  wrongQuestions: Question[];
  bookmarkedQuestions: Question[];
  hasSavedProgress: boolean;
  sessionQuestions: Question[];
  startQuiz: () => void;
  startWrongQuiz: () => void;
  resumeQuiz: () => void;
  clearSavedProgress: () => void;
  selectAnswer: (answerKey: string) => void;
  toggleMultipleAnswer: (answerKey: string) => void;
  submitMultipleAnswer: () => void;
  nextQuestion: () => void;
  previousQuestion: () => void;
  jumpToQuestion: (index: number) => void;
  endQuiz: () => void;
  resetStats: () => void;
  removeFromWrong: (questionId: number) => void;
  toggleBookmark: (question: Question) => void;
  isBookmarked: (questionId: number) => boolean;
}

const QuizContext = createContext<QuizContextType | undefined>(undefined);

const STORAGE_KEY = 'quiz_stats';
const WRONG_KEY = 'wrong_questions';
const PROGRESS_KEY = 'quiz_progress';
const BOOKMARK_KEY = 'bookmarked_questions';

const loadJson = <T,>(key: string, fallback: T): T => {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored);
    return parsed !== null && parsed !== undefined ? parsed : fallback;
  } catch {
    try { localStorage.removeItem(key); } catch { /* ignore cleanup failure */ }
    return fallback;
  }
};

const getInitialStats = (): QuizStats => loadJson(STORAGE_KEY, {
  totalSessions: 0, totalQuestionsAnswered: 0, correctAnswers: 0, accuracy: 0, recentSessions: []
});

const getWrongQuestions = (): Question[] => loadJson(WRONG_KEY, []);
const getBookmarkedQuestions = (): Question[] => loadJson(BOOKMARK_KEY, []);
const getSavedProgress = (): { session: QuizSession; questions: Question[]; index: number } | null =>
  loadJson(PROGRESS_KEY, null);

const saveJson = (key: string, value: unknown): boolean => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

let audioCtx: AudioContext | null = null;
const getAudioContext = (): AudioContext | null => {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch { return null; }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
};

const NOTE_C5 = 523;
const NOTE_E5 = 659;
const NOTE_G5 = 784;

const useDebouncedSave = <T,>(key: string, value: T, delay = 300) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => saveJson(key, value), delay);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [key, value, delay]);
};

const updateWrongQuestions = (
  isCorrect: boolean,
  question: Question,
  currentWrong: Question[],
  setWrongQuestions: React.Dispatch<React.SetStateAction<Question[]>>
) => {
  if (!isCorrect && !currentWrong.find(q => q.id === question.id)) {
    setWrongQuestions(prev => [...prev, question]);
  } else if (isCorrect && currentWrong.find(q => q.id === question.id)) {
    setWrongQuestions(prev => prev.filter(q => q.id !== question.id));
  }
};

const playSound = (type: 'correct' | 'wrong' | 'click') => {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'correct') {
      osc.frequency.setValueAtTime(NOTE_C5, ctx.currentTime);
      osc.frequency.setValueAtTime(NOTE_E5, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(NOTE_G5, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } else if (type === 'wrong') {
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.setValueAtTime(150, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    }
  } catch { /* AudioContext unavailable */ }
};

export const QuizProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { mode, questionCount, questionType, soundEnabled } = usePreferences();
  const bankContext = useContext(QuestionBankContext);
  const activeQuestions = useMemo(() => bankContext?.activeQuestions || [], [bankContext]);

  const [currentSession, setCurrentSession] = useState<QuizSession | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | string[] | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [stats, setStats] = useState<QuizStats>(getInitialStats);
  const [wrongQuestions, setWrongQuestions] = useState<Question[]>(getWrongQuestions);
  const wrongQuestionsRef = useRef(wrongQuestions);

  useEffect(() => {
    wrongQuestionsRef.current = wrongQuestions;
  }, [wrongQuestions]);

  const [bookmarkedQuestions, setBookmarkedQuestions] = useState<Question[]>(getBookmarkedQuestions);
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>([]);
  const [hasSavedProgress, setHasSavedProgress] = useState(() => getSavedProgress() !== null);

  useDebouncedSave(STORAGE_KEY, stats);
  useDebouncedSave(WRONG_KEY, wrongQuestions);
  useDebouncedSave(BOOKMARK_KEY, bookmarkedQuestions);

  useEffect(() => {
    if (currentSession && sessionQuestions.length > 0 && !currentSession.endTime) {
      saveJson(PROGRESS_KEY, { session: currentSession, questions: sessionQuestions, index: currentQuestionIndex });
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasSavedProgress(true);
    }
  }, [currentSession, sessionQuestions, currentQuestionIndex]);

  const getFilteredQuestions = useCallback((): Question[] => {
    let filtered = [...activeQuestions];
    if (questionType !== 'all') {
      filtered = filtered.filter(q => q.questionType === questionType);
    }
    return filtered;
  }, [activeQuestions, questionType]);

  const clearProgress = () => {
    try { localStorage.removeItem(PROGRESS_KEY); } catch { /* ignore */ }
  };

  const startQuiz = useCallback(() => {
    let selected = getFilteredQuestions();
    if (mode === 'random') selected = selected.sort(() => Math.random() - 0.5);
    const qs = mode === 'study' ? selected : selected.slice(0, Math.min(questionCount, selected.length));
    setSessionQuestions(qs);
    setCurrentSession({
      id: Date.now().toString(), mode, questionType,
      totalQuestions: qs.length, score: 0, answers: [], startTime: Date.now()
    });
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setHasAnswered(false);
    setIsCorrect(null);
    clearProgress();
  }, [getFilteredQuestions, mode, questionCount, questionType]);

  const startWrongQuiz = useCallback(() => {
    let selected = [...wrongQuestions];
    if (mode === 'random') selected = selected.sort(() => Math.random() - 0.5);
    const qs = selected.slice(0, Math.min(questionCount, selected.length));
    setSessionQuestions(qs);
    setCurrentSession({
      id: Date.now().toString(), mode, questionType: 'all',
      totalQuestions: qs.length, score: 0, answers: [], startTime: Date.now()
    });
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setHasAnswered(false);
    setIsCorrect(null);
    clearProgress();
  }, [wrongQuestions, mode, questionCount]);

  const resumeQuiz = useCallback(() => {
    const saved = getSavedProgress();
    if (saved) {
      setSessionQuestions(saved.questions);
      setCurrentSession(saved.session);
      setCurrentQuestionIndex(saved.index);
      setSelectedAnswer(null);
      setHasAnswered(false);
      setIsCorrect(null);
    }
  }, []);

  const clearSavedProgress = useCallback(() => {
    clearProgress();
    setHasSavedProgress(false);
  }, []);

  const currentQuestion = sessionQuestions[currentQuestionIndex] || null;

  const checkAnswer = useCallback((selected: string | string[]): boolean => {
    if (!currentQuestion) return false;
    const correct = currentQuestion.answer;
    if (Array.isArray(correct)) {
      if (!Array.isArray(selected)) return false;
      return JSON.stringify([...correct].sort()) === JSON.stringify([...selected].sort());
    }
    return selected === correct;
  }, [currentQuestion]);

  const selectAnswer = useCallback((answerKey: string) => {
    if (!currentSession || hasAnswered || !currentQuestion) return;

    let answer: string | string[] = answerKey;

    if (currentQuestion.questionType === 'multiple') {
      const prev = Array.isArray(selectedAnswer) ? selectedAnswer : [];
      answer = prev.includes(answerKey) ? prev.filter(k => k !== answerKey) : [...prev, answerKey];
    }

    setSelectedAnswer(answer);

    if (currentQuestion.questionType !== 'multiple' && currentQuestion.questionType !== 'essay') {
      const correct = checkAnswer(answer);
      setHasAnswered(true);
      setIsCorrect(correct);
      if (soundEnabled) playSound(correct ? 'correct' : 'wrong');

      const userAnswer: UserAnswer = { questionId: currentQuestion.id, selectedKey: answer, isCorrect: correct };
      setCurrentSession(prev => prev ? { ...prev, score: correct ? prev.score + 1 : prev.score, answers: [...prev.answers, userAnswer] } : prev);

      updateWrongQuestions(correct, currentQuestion, wrongQuestionsRef.current, setWrongQuestions);
    } else if (currentQuestion.questionType === 'essay') {
      setHasAnswered(true);
      setIsCorrect(null);
      const userAnswer: UserAnswer = { questionId: currentQuestion.id, selectedKey: answer, isCorrect: null };
      setCurrentSession(prev => prev ? { ...prev, answers: [...prev.answers, userAnswer] } : prev);
    }
  }, [currentSession, hasAnswered, currentQuestion, selectedAnswer, soundEnabled, checkAnswer]);

  const toggleMultipleAnswer = useCallback((answerKey: string) => { selectAnswer(answerKey); }, [selectAnswer]);

  const submitMultipleAnswer = useCallback(() => {
    if (!currentSession || hasAnswered || !selectedAnswer || !currentQuestion) return;
    if (Array.isArray(selectedAnswer) && selectedAnswer.length === 0) return;

    const correct = checkAnswer(selectedAnswer);
    setHasAnswered(true);
    setIsCorrect(correct);
    if (soundEnabled) playSound(correct ? 'correct' : 'wrong');

    const userAnswer: UserAnswer = { questionId: currentQuestion.id, selectedKey: selectedAnswer, isCorrect: correct };
    setCurrentSession(prev => prev ? { ...prev, score: correct ? prev.score + 1 : prev.score, answers: [...prev.answers, userAnswer] } : prev);

    updateWrongQuestions(correct, currentQuestion, wrongQuestionsRef.current, setWrongQuestions);
  }, [currentSession, hasAnswered, selectedAnswer, currentQuestion, soundEnabled, checkAnswer]);

  const endQuiz = useCallback(() => {
    if (!currentSession) return;
    const completed: QuizSession = { ...currentSession, endTime: Date.now() };
    const correctCount = completed.answers.filter(a => a.isCorrect).length;
    const totalAnswered = completed.answers.length;

    setStats(prev => {
      const totalCorrect = prev.correctAnswers + correctCount;
      const totalAll = prev.totalQuestionsAnswered + totalAnswered;
      return {
        totalSessions: prev.totalSessions + 1,
        totalQuestionsAnswered: totalAll,
        correctAnswers: totalCorrect,
        accuracy: totalAll > 0 ? Math.round((totalCorrect / totalAll) * 100) : 0,
        recentSessions: [completed, ...prev.recentSessions].slice(0, 20)
      };
    });
    setCurrentSession(completed);
    clearProgress();
  }, [currentSession]);

  const nextQuestion = useCallback(() => {
    if (currentQuestionIndex < sessionQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setHasAnswered(false);
      setIsCorrect(null);
    } else {
      endQuiz();
    }
  }, [currentQuestionIndex, sessionQuestions.length, endQuiz]);

  const previousQuestion = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      setSelectedAnswer(null);
      setHasAnswered(false);
      setIsCorrect(null);
    }
  }, [currentQuestionIndex]);

  const jumpToQuestion = useCallback((index: number) => {
    if (index >= 0 && index < sessionQuestions.length) {
      setCurrentQuestionIndex(index);
      setSelectedAnswer(null);
      setHasAnswered(false);
      setIsCorrect(null);
    }
  }, [sessionQuestions.length]);

  const resetStats = useCallback(() => {
    setStats({ totalSessions: 0, totalQuestionsAnswered: 0, correctAnswers: 0, accuracy: 0, recentSessions: [] });
  }, []);

  const removeFromWrong = useCallback((questionId: number) => {
    setWrongQuestions(prev => prev.filter(q => q.id !== questionId));
  }, []);

  const toggleBookmark = useCallback((question: Question) => {
    setBookmarkedQuestions(prev => {
      const exists = prev.find(q => q.id === question.id);
      return exists ? prev.filter(q => q.id !== question.id) : [...prev, question];
    });
  }, []);

  const isBookmarked = useCallback((questionId: number) => {
    return bookmarkedQuestions.some(q => q.id === questionId);
  }, [bookmarkedQuestions]);

  const contextValue = useMemo(() => ({
    currentSession, currentQuestionIndex, currentQuestion, selectedAnswer,
    hasAnswered, isCorrect, stats, wrongQuestions, bookmarkedQuestions, hasSavedProgress,
    sessionQuestions,
    startQuiz, startWrongQuiz, resumeQuiz, clearSavedProgress,
    selectAnswer, toggleMultipleAnswer, submitMultipleAnswer,
    nextQuestion, previousQuestion, jumpToQuestion, endQuiz, resetStats, removeFromWrong, toggleBookmark, isBookmarked
  }), [
    currentSession, currentQuestionIndex, currentQuestion, selectedAnswer,
    hasAnswered, isCorrect, stats, wrongQuestions, bookmarkedQuestions, hasSavedProgress,
    sessionQuestions,
    startQuiz, startWrongQuiz, resumeQuiz, clearSavedProgress,
    selectAnswer, toggleMultipleAnswer, submitMultipleAnswer,
    nextQuestion, previousQuestion, jumpToQuestion, endQuiz, resetStats, removeFromWrong, toggleBookmark, isBookmarked
  ]);

  return (
    <QuizContext.Provider value={contextValue}>
      {children}
    </QuizContext.Provider>
  );
};

export default QuizContext;
