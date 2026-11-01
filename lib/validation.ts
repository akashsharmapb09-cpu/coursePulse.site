import { z } from 'zod';
import { QUESTION_CATEGORIES } from './question-categories';

export const courseInput = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5000).default('')
}).strict();

export { QUESTION_CATEGORIES as questionCategories } from '@/lib/question-categories';

export const questionSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,48}$/),
  label: z.string().trim().min(2).max(180),
  type: z.enum(['rating', 'single_choice', 'multiple_choice', 'text', 'textarea', 'number', 'yes_no']),
  category: z.enum(QUESTION_CATEGORIES).optional(),
  required: z.boolean().default(true),
  options: z.array(z.string().trim().min(1).max(100)).max(20).optional()
}).strict().superRefine((q, ctx) => {
  if (['single_choice', 'multiple_choice'].includes(q.type) && (!q.options || q.options.length < 2)) {
    ctx.addIssue({ code: 'custom', message: 'Choice questions need at least two options.', path: ['options'] });
  }
});

export const feedbackInput = z.object({
  course_id: z.string().uuid(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(3000).default(''),
  retention_days: z.number().int().min(30).max(730).default(365),
  due_at: z.string().datetime().nullable().optional(),
  form_schema: z.array(questionSchema).min(1).max(30)
}).strict().superRefine((input, ctx) => {
  const ids = input.form_schema.map(q => q.id);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Question IDs must be unique.', path: ['form_schema'] });
});

export const responseInput = z.object({
  feedback_id: z.string().uuid(),
  answers: z.record(z.string(), z.unknown()).refine(v => Object.keys(v).length <= 30)
}).strict();

export type Question = z.infer<typeof questionSchema>;
