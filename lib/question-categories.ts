import type { SupabaseClient } from '@supabase/supabase-js';

export const QUESTION_CATEGORIES = [
  'Course Content',
  'Teaching Effectiveness',
  'Communication',
  'Course Organization',
  'Assessment',
  'Learning Resources',
  'Overall Satisfaction'
] as const;

export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number];

export function isQuestionCategory(value: string): value is QuestionCategory {
  return (QUESTION_CATEGORIES as readonly string[]).includes(value);
}

export type CategorizedQuestionRow = {
  feedback_id: string;
  question_id: string;
};

export function buildQuestionCategoryMap(
  forms: Array<{ id: string; form_schema: unknown }>
): Map<string, QuestionCategory> {
  const categories = new Map<string, QuestionCategory>();
  for (const form of forms) {
    if (!Array.isArray(form.form_schema)) continue;
    for (const item of form.form_schema) {
      if (!item || typeof item !== 'object') continue;
      const question = item as { id?: unknown; category?: unknown };
      if (typeof question.id === 'string' && typeof question.category === 'string' && isQuestionCategory(question.category)) {
        categories.set(`${form.id}:${question.id}`, question.category);
      }
    }
  }
  return categories;
}

export function attachQuestionCategories<T extends CategorizedQuestionRow>(
  rows: T[],
  categories: Map<string, QuestionCategory>
): Array<T & { question_category: QuestionCategory | null }> {
  return rows.map(row => ({
    ...row,
    question_category: categories.get(`${row.feedback_id}:${row.question_id}`) ?? null
  }));
}

export async function loadQuestionCategoryMap(
  supabase: SupabaseClient,
  feedbackIds: string[]
): Promise<{ categories: Map<string, QuestionCategory>; error: string | null }> {
  const ids = Array.from(new Set(feedbackIds));
  if (!ids.length) return { categories: new Map(), error: null };
  const { data, error } = await supabase
    .from('feedback')
    .select('id,form_schema')
    .in('id', ids);
  if (error) return { categories: new Map(), error: error.message };
  return { categories: buildQuestionCategoryMap(data ?? []), error: null };
}
