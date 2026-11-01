import { describe, expect, it } from 'vitest';
import { questionListSchema } from '../lib/validation';
import { validateResponseAnswers } from '../lib/response-validation';

describe('feedback answer validation', () => {
  it('rejects duplicate question IDs and duplicate choice options', () => {
    const duplicateIds = questionListSchema.safeParse([
      { id: 'q-one', label: 'Question one', type: 'rating' },
      { id: 'q-one', label: 'Question two', type: 'text' }
    ]);
    const duplicateOptions = questionListSchema.safeParse([
      { id: 'q-choice', label: 'Choose an option', type: 'multiple_select', options: ['Yes', 'yes'] }
    ]);
    expect(duplicateIds.success).toBe(false);
    expect(duplicateOptions.success).toBe(false);
  });

  it('rejects unknown answer keys and whitespace-only required text', () => {
    const questions = questionListSchema.parse([
      { id: 'q-text', label: 'What helped?', type: 'textarea', required: true }
    ]);
    expect(validateResponseAnswers(questions, { 'q-text': '   ' })).toMatch(/Please answer/);
    expect(validateResponseAnswers(questions, { 'q-text': 'Useful examples' })).toBeNull();
    expect(validateResponseAnswers(questions, { 'q-text': 'Useful examples', injected: 'value' })).toMatch(/unknown question/);
  });

  it('allows blank optional answers while validating provided values by type', () => {
    const questions = questionListSchema.parse([
      { id: 'q-optional', label: 'Optional comment', type: 'text', required: false },
      { id: 'q-rating', label: 'Rate the course', type: 'rating', required: true }
    ]);
    expect(validateResponseAnswers(questions, { 'q-optional': '   ', 'q-rating': 4 })).toBeNull();
    expect(validateResponseAnswers(questions, { 'q-optional': null, 'q-rating': 6 })).toMatch(/Ratings must/);
  });

  it('validates all supported answer types and rejects repeated checkbox choices', () => {
    const questions = questionListSchema.parse([
      { id: 'q-yes', label: 'Was it clear?', type: 'yes_no' },
      { id: 'q-number', label: 'How many hours?', type: 'number' },
      { id: 'q-single', label: 'Choose one', type: 'single_choice', options: ['A', 'B'] },
      { id: 'q-many', label: 'Choose many', type: 'multiple_select', options: ['A', 'B'] }
    ]);
    expect(validateResponseAnswers(questions, { 'q-yes': 'Yes', 'q-number': 2, 'q-single': 'A', 'q-many': ['A', 'B'] })).toBeNull();
    expect(validateResponseAnswers(questions, { 'q-yes': 'Maybe', 'q-number': 2, 'q-single': 'A', 'q-many': ['A'] })).toMatch(/Yes or No/);
    expect(validateResponseAnswers(questions, { 'q-yes': 'No', 'q-number': 2, 'q-single': 'A', 'q-many': ['A', 'A'] })).toMatch(/valid options/);
  });
});
