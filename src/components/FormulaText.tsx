import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface FormulaTextProps {
  text: string;
  className?: string;
}

const renderFormula = (formula: string, displayMode: boolean): string => {
  try {
    return katex.renderToString(formula, {
      displayMode,
      throwOnError: false,
      trust: true,
    });
  } catch {
    return `<span class="formula-error">${formula}</span>`;
  }
};

const parseFormulas = (text: string): string => {
  if (!text) return '';

  let result = text;

  result = result.replace(/\$\$([\s\S]+?)\$\$/g, (_, formula) => {
    return renderFormula(formula.trim(), true);
  });

  result = result.replace(/\$([^\n$]+?)\$/g, (_, formula) => {
    return renderFormula(formula.trim(), false);
  });

  result = result.replace(/\\\((.+?)\\\)/g, (_, formula) => {
    return renderFormula(formula.trim(), false);
  });

  result = result.replace(/\\\[(.+?)\\\]/g, (_, formula) => {
    return renderFormula(formula.trim(), true);
  });

  return result;
};

const FormulaText: React.FC<FormulaTextProps> = ({ text, className = '' }) => {
  const html = useMemo(() => DOMPurify.sanitize(parseFormulas(text)), [text]);

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default FormulaText;
