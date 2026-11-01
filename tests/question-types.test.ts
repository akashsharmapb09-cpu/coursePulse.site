import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { questionSchema } from '../lib/validation';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261101065511_coursepulse_yes_no_question_type.sql'), 'utf8');
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
    expect(responsesRoute).toContain("value !== 'Yes' && value !== 'No'");
  });

  it('renders a Yes/No control and exposes every master-prompt category in the builder', () => {
    expect(dashboard).toContain('<option value="yes_no">Yes / No</option>');
    for (const category of ['Course Content', 'Teaching Effectiveness', 'Communication', 'Course Organization', 'Assessment', 'Learning Resources', 'Overall Satisfaction']) {
      expect(dashboard).toContain(category);
    }
  });

  it('enforces Yes/No values in the database submission function', () => {
    expect(migration).toContain("when 'yes_no' then");
    expect(migration).toContain("v_value #>> '{}' not in ('Yes', 'No')");
    expect(migration).toContain("errcode = '22023'");
  });
});
