import type { Question } from '../../types';
import { inferQuestionType } from './helpers';

const isValidQuestion = (q: Record<string, unknown>): boolean => {
  const questionText = q.question ?? q.text;
  const answer = q.answer ?? q.correctAnswer;
  return typeof questionText === 'string' && questionText.trim() !== '' &&
    (typeof answer === 'string' && answer.trim() !== '' || Array.isArray(answer));
};

const mapQuestion = (q: Record<string, unknown>, i: number): Question => {
  const options = q.options as Question['options'];
  const rawAnswer = (q.answer || q.correctAnswer || '') as string | string[];
  const qType = inferQuestionType(options, rawAnswer, q.questionType as string | undefined);
  let ans: string | string[] = rawAnswer;
  if (qType === 'multiple' && typeof ans === 'string' && /^[A-Fa-f]{2,}$/.test(ans)) {
    ans = ans.split('');
  }
  return {
    id: (q.id as number) || i + 1,
    question: (q.question || q.text || '') as string,
    options: q.options as Question['options'] || undefined,
    answer: ans,
    questionType: qType,
    explanation: q.explanation as string | undefined,
    questionImage: q.questionImage as string | undefined,
    optionImages: q.optionImages as Question['optionImages'],
    answerImage: q.answerImage as string | undefined,
  };
};

export const parseJsonQuestions = (jsonString: string): Question[] => {
  try {
    const data = JSON.parse(jsonString);
    if (Array.isArray(data)) {
      return data
        .filter((q): q is Record<string, unknown> => isValidQuestion(q))
        .map((q, i) => mapQuestion(q, i));
    }
    if (data.questions && Array.isArray(data.questions)) {
      return data.questions
        .filter((q: Record<string, unknown>): q is Record<string, unknown> => isValidQuestion(q))
        .map((q: Record<string, unknown>, i: number) => mapQuestion(q, i));
    }
    return [];
  } catch (e) {
    console.error('Failed to parse JSON:', e);
    return [];
  }
};
