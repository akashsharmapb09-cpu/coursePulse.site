import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { questionSchema } from '../lib/validation';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261101065511_coursepulse_yes_no_question_type.sql'), 'utf8');
const multipleSelectMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261101065824_coursepulse_multiple_select_question_type.sql'), 'utf8');
const responsesRoute = readFileSync(resolve(process.cwd(), 'app/api/responses/route.ts'), 'utf8');
const dashboard = readFileSync(resolve(process.cwd(), 'components/dashboard.tsx'), 'utf8');

describe('supported feedback question types', () => {
  it('accepts Yes/No questions with a supported academic category', () => {
    expect(questionSchema.safeParse({
      id: 'q-yes-no',
      label: 'Were the learning goals clear?',
      type: 'yes_no',
      category: 'Teaching Effectiveness',
      required: true
    }).success).toBe(true);
    expect(questionSchema.safeParse({ id: 'q-multi', label: 'Select applicable topics', type: 'multiple_select', category: 'Course Content', options: ['A', 'B'], required: false }).success).toBe(true);
  });

  it('rejects unknown categories and unsupported Yes/No values at the API boundary', () => {
    expect(questionSchema.safeParse({
      id: 'q-invalid',
      label: 'Was the course useful?',
      type: 'yes_no',
      category: 'Invented category',
      required: true
    }).success).toBe(false);
    expect(responsesRoute).toContain("q.type === 'yes_no'");
    expect(responsesRoute).toContain("['multiple_choice', 'multiple_select'].includes(q.type)");
    expect(responsesRoute).toContain("value !== 'Yes' && value !== 'No'");
  });

  it('renders a Yes/No control and exposes every master-prompt category in the builder', () => {
    expect(dashboard).toContain('<option value="yes_no">Yes / No</option>');
    expect(dashboard).toContain('<option value="multiple_select">Multiple selection (checkboxes)</option>');
    expect(dashboard).toContain("question.type === 'multiple_select'");
    expect(dashboard).toContain("crypto.randomUUID().replaceAll('-','')");
    expect(dashboard).toContain('id: question.id');
    expect(dashboard).toContain('reorderQuestionItems(current,index,target)');
    expect(dashboard).toContain('Move question');
    expect(dashboard).toContain("tab==='history'");
    expect(dashboard).toContain("if (question.required && unanswered)");
    expect(dashboard).toContain('<fieldset key={question.id}');
    for (const category of ['Course Content', 'Teaching Effectiveness', 'Communication', 'Course Organization', 'Assessment', 'Learning Resources', 'Overall Satisfaction']) {
      expect(dashboard).toContain(category);
    }
  });

  it('enforces Yes/No values in the database submission function', () => {
    expect(migration).toContain("when 'yes_no' then");
    expect(migration).toContain("v_value #>> '{}' not in ('Yes', 'No')");
    expect(migration).toContain("errcode = '22023'");
  });

  it('extends database validation to the separate Multiple selection question type', () => {
    expect(multipleSelectMigration).toContain("when 'multiple_choice', 'multiple_select' then");
    expect(multipleSelectMigration).toContain("Could not locate multiple-choice validation");
  });
});
