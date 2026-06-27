import React, { createContext, useState, useEffect, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Question } from '../types';
import { processFile, questionsToJson, questionsToMarkdown } from '../utils/fileParser';

const generateId = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

interface QuestionBank {
  id: string;
  name: string;
  source: string;
  questions: Question[];
  createdAt: number;
}

interface QuestionBankContextType {
  banks: QuestionBank[];
  activeBankId: string | null;
  activeBankName: string;
  activeQuestions: Question[];
  addBank: (name: string, source: string, questions: Question[]) => void;
  removeBank: (bankId: string) => void;
  setActiveBank: (bankId: string | null) => void;
  processUploadedFile: (file: File) => Promise<{ name: string; questions: Question[] }>;
  exportBank: (bankId: string, format: 'json' | 'md') => string;
}

const QuestionBankContext = createContext<QuestionBankContextType | undefined>(undefined);

const STORAGE_KEY = 'question_banks';
const ACTIVE_KEY = 'active_bank';

const isValidBank = (bank: unknown): bank is QuestionBank => {
  if (typeof bank !== 'object' || bank === null) return false;
  const obj = bank as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    Array.isArray(obj.questions)
  );
};

const getInitialBanks = (): QuestionBank[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.filter(isValidBank);
      }
    }
  } catch (e) {
    console.error('Failed to load question banks:', e);
  }
  return [];
};

const getActiveBankId = (): string | null => {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
};

const saveBanks = (banks: QuestionBank[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(banks));
  } catch (e) {
    console.error('Failed to save question banks:', e);
  }
};

const saveActiveBankId = (bankId: string | null) => {
  try {
    if (bankId) {
      localStorage.setItem(ACTIVE_KEY, bankId);
    } else {
      localStorage.removeItem(ACTIVE_KEY);
    }
  } catch (e) {
    console.error('Failed to save active bank:', e);
  }
};

export const QuestionBankProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [banks, setBanks] = useState<QuestionBank[]>(getInitialBanks);
  const [activeBankId, setActiveBankId] = useState<string | null>(getActiveBankId);

  useEffect(() => {
    saveBanks(banks);
  }, [banks]);

  useEffect(() => {
    saveActiveBankId(activeBankId);
  }, [activeBankId]);

  const activeBank = useMemo(() => activeBankId ? banks.find(b => b.id === activeBankId) : null, [banks, activeBankId]);
  const activeQuestions = useMemo(() => activeBank?.questions || [], [activeBank]);
  const activeBankName = useMemo(() => activeBank?.name || '请上传题库', [activeBank]);

  const addBank = useCallback((name: string, source: string, questions: Question[]) => {
    const newBank: QuestionBank = {
      id: generateId(),
      name,
      source,
      questions,
      createdAt: Date.now()
    };
    setBanks(prev => [...prev, newBank]);
    setActiveBankId(newBank.id);
  }, []);

  const removeBank = useCallback((bankId: string) => {
    setBanks(prev => prev.filter(b => b.id !== bankId));
    setActiveBankId(prev => prev === bankId ? null : prev);
  }, []);

  const setActiveBank = useCallback((bankId: string | null) => {
    setActiveBankId(bankId);
  }, []);

  const processUploadedFile = useCallback(async (file: File): Promise<{ name: string; questions: Question[] }> => {
    const questions = await processFile(file);
    const name = file.name.replace(/\.[^/.]+$/, '');
    return { name, questions };
  }, []);

  const exportBank = useCallback((bankId: string, format: 'json' | 'md'): string => {
    const bank = banks.find(b => b.id === bankId);
    if (!bank) return '';

    return format === 'json'
      ? questionsToJson(bank.questions)
      : questionsToMarkdown(bank.questions);
  }, [banks]);

  const contextValue = useMemo(() => ({
    banks,
    activeBankId,
    activeBankName,
    activeQuestions,
    addBank,
    removeBank,
    setActiveBank,
    processUploadedFile,
    exportBank
  }), [banks, activeBankId, activeBankName, activeQuestions, addBank, removeBank, setActiveBank, processUploadedFile, exportBank]);

  return (
    <QuestionBankContext.Provider value={contextValue}>
      {children}
    </QuestionBankContext.Provider>
  );
};

export default QuestionBankContext;