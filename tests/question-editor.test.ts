import { describe, expect, it } from 'vitest';
import { moveQuestion, normalizeQuestionOptions } from '../lib/question-editor';

describe('feedback question editor data integrity', () => {
  it('reorders complete question objects while retaining their stable IDs', () => {
    const questions = [
      { id: 'q-a', label: 'First', existingAnswers: 5 },
      { id: 'q-b', label: 'Second', existingAnswers: 8 },
      { id: 'q-c', label: 'Third', existingAnswers: 2 }
    ];
    const reordered = moveQuestion(questions, 0, 2);
    expect(reordered.map(question => question.id)).toEqual(['q-b', 'q-c', 'q-a']);
    expect(reordered.find(question => question.id === 'q-b')?.existingAnswers).toBe(8);
    expect(questions.map(question => question.id)).toEqual(['q-a', 'q-b', 'q-c']);
  });

  it('does not move questions outside the valid list range', () => {
    const questions = [{ id: 'q-a' }, { id: 'q-b' }];
    expect(moveQuestion(questions, -1, 0)).toEqual(questions);
    expect(moveQuestion(questions, 0, 2)).toEqual(questions);
  });

  it('normalizes choice options without altering question identifiers', () => {
    expect(normalizeQuestionOptions([' A ', '', 'B'])).toEqual(['A', 'B']);
    expect(normalizeQuestionOptions(undefined)).toBeUndefined();
  });
});
