import { z } from 'zod';
import { QUESTION_CATEGORIES } from './question-categories';

export const courseInput = z.object({
  course_code: z.string().trim().min(2).max(30).optional().nullable(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5000).default('')
}).strict();

export { QUESTION_CATEGORIES as questionCategories } from './question-categories';

export const questionSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,48}$/),
  label: z.string().trim().min(2).max(180),
  type: z.enum(['rating', 'single_choice', 'multiple_choice', 'text', 'textarea', 'number', 'yes_no', 'multiple_select']),
  category: z.enum(QUESTION_CATEGORIES).optional(),
  required: z.boolean().default(true),
  options: z.array(z.string().trim().min(1).max(100)).max(20).optional()
}).strict().superRefine((q, ctx) => {
  if (['single_choice', 'multiple_choice', 'multiple_select'].includes(q.type) && (!q.options || q.options.length < 2)) {
    ctx.addIssue({ code: 'custom', message: 'Choice questions need at least two options.', path: ['options'] });
  }
  if (q.options && new Set(q.options.map(option => option.toLowerCase())).size !== q.options.length) {
    ctx.addIssue({ code: 'custom', message: 'Choice options must be unique.', path: ['options'] });
  }
});

export const questionListSchema = z.array(questionSchema).min(1).max(30).superRefine((questions, ctx) => {
  const seen = new Set<string>();
  questions.forEach((question, index) => {
    if (seen.has(question.id)) {
      ctx.addIssue({ code: 'custom', message: 'Question IDs must be unique.', path: [index, 'id'] });
    }
    seen.add(question.id);
  });
});

export const feedbackInput = z.object({
  course_id: z.string().uuid(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(3000).default(''),
  retention_days: z.number().int().min(30).max(730).default(365),
  due_at: z.string().datetime().nullable().optional(),
  form_schema: questionListSchema
}).strict();

export const responseInput = z.object({
  feedback_id: z.string().uuid(),
  answers: z.record(z.string(), z.unknown()).refine(v => Object.keys(v).length <= 30)
}).strict();

export type Question = z.infer<typeof questionSchema>;


export const feedbackUpdateInput = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(3000).optional(),
  due_at: z.string().datetime().nullable().optional(),
  retention_days: z.number().int().min(30).max(730).optional(),
  form_schema: questionListSchema.optional()
}).strict().refine(value => Object.keys(value).length > 0, 'Provide at least one field to update');

export const courseAdminInput = z.object({
  title: z.string().trim().min(2).max(160), description: z.string().trim().max(5000).default(''),
  course_code: z.string().trim().max(32).nullable().optional(), department_id: z.string().uuid().nullable().optional(),
  semester_id: z.string().uuid().nullable().optional(), instructor_id: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT')
}).strict();
const analyticsCategory = z.enum(['Course Content', 'Teaching Effectiveness', 'Communication', 'Course Organization', 'Assessment', 'Learning Resources', 'Overall Satisfaction']);
export const analyticsFilterInput = z.object({
  course_id: z.string().uuid().optional(), semester_id: z.string().uuid().optional(), department_id: z.string().uuid().optional(),
  instructor_id: z.string().uuid().optional(), academic_year: z.string().regex(/^[0-9]{4}-[0-9]{4}$/).optional(),
  category: analyticsCategory.optional(), from_date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/).optional(),
  to_date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/).optional()
}).strict().superRefine((filters, ctx) => {
  if (filters.from_date && filters.to_date && filters.from_date > filters.to_date) ctx.addIssue({ code: 'custom', message: 'Start date must be on or before end date.', path: ['from_date'] });
  if (filters.academic_year && Number(filters.academic_year.slice(5)) !== Number(filters.academic_year.slice(0, 4)) + 1) ctx.addIssue({ code: 'custom', message: 'Academic year must be a consecutive year range.', path: ['academic_year'] });
  for (const field of ['from_date', 'to_date'] as const) { const value=filters[field]; if(value){const date=new Date(`${value}T00:00:00.000Z`); if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==value)ctx.addIssue({code:'custom',message:'Date must be a real calendar date.',path:[field]});} }
});
