declare global {
  interface Window {
    electronAPI?: {
      showOpenDialog: (options: { filters?: { name: string; extensions: string[] }[]; properties?: string[] }) => Promise<{ filePaths: string[] }>;
      readFile: (filePath: string) => Promise<ArrayBuffer>;
      convertFile: (fileBuffer: ArrayBuffer, fileName: string) => Promise<string>;
    };
  }
}

export type QuestionType = 'single' | 'multiple' | 'judge' | 'essay';

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single: '单选题',
  multiple: '多选题',
  judge: '判断题',
  essay: '简答题'
};

export const QUESTION_TYPE_SHORT_LABELS: Record<QuestionType, string> = {
  single: '单选',
  multiple: '多选',
  judge: '判断',
  essay: '简答'
};

const QUESTION_TYPE_SET = new Set<string>(['single', 'multiple', 'judge', 'essay']);

export const isQuestionType = (v: string): v is QuestionType => QUESTION_TYPE_SET.has(v);

export interface Question {
  id: number;
  question: string;
  options?: Array<{
    key: string;
    text: string;
  }>;
  answer: string | string[];
  questionType: QuestionType;
  explanation?: string;
  questionImage?: string;
  optionImages?: { key: string; image: string }[];
  answerImage?: string;
}

export interface UserAnswer {
  questionId: number;
  selectedKey: string | string[];
  isCorrect: boolean | null;
}

export interface QuizSession {
  id: string;
  mode: 'sequential' | 'random' | 'study';
  questionType: QuestionType | 'all';
  totalQuestions: number;
  score: number;
  answers: UserAnswer[];
  startTime: number;
  endTime?: number;
}

export interface QuizStats {
  totalSessions: number;
  totalQuestionsAnswered: number;
  correctAnswers: number;
  accuracy: number;
  recentSessions: QuizSession[];
}

export interface QuestionAttempt {
  date: number;
  isCorrect: boolean;
}

export interface QuestionHistory {
  questionId: number;
  bankId: string;
  totalAttempts: number;
  correctAttempts: number;
  lastAttemptedAt: number;
  attempts: QuestionAttempt[];
}

export interface BankProgress {
  bankId: string;
  totalQuestions: number;
  answeredQuestions: number;
  masteredQuestions: number;
  accuracy: number;
  lastStudiedAt: number;
}

export interface ProgressData {
  questionHistory: QuestionHistory[];
  bankProgress: BankProgress[];
}