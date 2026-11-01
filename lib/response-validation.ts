import type { Question } from './validation';

export function validateResponseAnswers(
  questions: readonly Question[],
  answers: Record<string, unknown>
): string | null {
  const expected = new Set(questions.map(question => question.id));
  if (Object.keys(answers).some(key => !expected.has(key))) {
    return 'Response contains unknown question fields.';
  }

  for (const question of questions) {
    const value = answers[question.id];
    const blank = value === undefined
      || value === null
      || (typeof value === 'string' && value.trim().length === 0)
      || (Array.isArray(value) && value.length === 0);

    if (blank) {
      if (question.required) return `Please answer: ${question.label}`;
      continue;
    }

    if (question.type === 'rating' && (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 5)) {
      return 'Ratings must be a whole number from 1 to 5.';
    }
    if (question.type === 'yes_no' && value !== 'Yes' && value !== 'No') {
      return 'Please answer Yes or No.';
    }
    if (question.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1000000)) {
      return 'Numeric answer is invalid.';
    }
    if (['text', 'textarea'].includes(question.type) && (typeof value !== 'string' || value.length > 2000)) {
      return 'Written answers must be 2,000 characters or fewer.';
    }
    if (question.type === 'single_choice' && (typeof value !== 'string' || !question.options?.includes(value))) {
      return 'Please choose a valid option.';
    }
    if (['multiple_choice', 'multiple_select'].includes(question.type)) {
      if (
        !Array.isArray(value)
        || value.length > 20
        || value.some(option => typeof option !== 'string' || !question.options?.includes(option))
        || new Set(value).size !== value.length
      ) {
        return 'Please choose valid options.';
      }
    }
  }

  return null;
}
