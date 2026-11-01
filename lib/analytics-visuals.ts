import { QUESTION_CATEGORIES } from '@/lib/question-categories';

export type RatingBin = { rating_value: number; response_count: number };
export type CategoryAggregate = { question_category?: string | null; question_type?: string | null; avg_numeric_value?: number | string | null; response_count?: number | string | null };
export type CategoryPerformance = { category: string; average: number; response_count: number };
export type DonutSegment = { rating: number; count: number; start: number; end: number; color: string };
export type SentimentSummary = { positive: number; neutral: number; negative: number; total: number };

const RATING_COLORS: Record<number, string> = { 1: '#b45c4a', 2: '#d18a61', 3: '#a47b32', 4: '#5d956f', 5: '#397b56' };
const ALLOWED_CATEGORIES = new Set<string>(QUESTION_CATEGORIES);

export function summarizeCategoryPerformance(rows: readonly CategoryAggregate[]): CategoryPerformance[] {
  const scores = new Map<string, { weightedTotal: number; responseCount: number }>();
  for (const row of rows) {
    const category = row.question_category;
    const average = Number(row.avg_numeric_value);
    const count = Number(row.response_count);
    if (!category || !ALLOWED_CATEGORIES.has(category)) continue;
    if (row.question_type !== 'rating' || !Number.isFinite(average) || average < 1 || average > 5) continue;
    if (!Number.isInteger(count) || count < 5) continue;
    const current = scores.get(category) ?? { weightedTotal: 0, responseCount: 0 };
    current.weightedTotal += average * count;
    current.responseCount += count;
    scores.set(category, current);
  }
  return QUESTION_CATEGORIES.flatMap(category => {
    const score = scores.get(category);
    return score ? [{ category, average: score.weightedTotal / score.responseCount, response_count: score.responseCount }] : [];
  });
}

export function buildRatingDonutSegments(values: readonly RatingBin[]) {
  const clean = values.filter(value => Number.isInteger(Number(value.rating_value)) && Number(value.rating_value) >= 1 && Number(value.rating_value) <= 5)
    .map(value => ({ rating: Number(value.rating_value), count: Math.max(0, Math.floor(Number(value.response_count) || 0)) }))
    .filter(value => value.count > 0).sort((a, b) => a.rating - b.rating);
  const total = clean.reduce((sum, value) => sum + value.count, 0);
  let cursor = 0;
  const segments: DonutSegment[] = clean.map(value => {
    const start = cursor;
    cursor += value.count;
    return { ...value, start: start / Math.max(total, 1) * 100, end: cursor / Math.max(total, 1) * 100, color: RATING_COLORS[value.rating] };
  });
  const gradient = total ? 'conic-gradient(' + segments.map(segment => segment.color + ' ' + segment.start + '% ' + segment.end + '%').join(', ') + ')' : 'conic-gradient(#e5ebe6 0% 100%)';
  return { total, segments, gradient };
}

export function summarizeRatingSentiment(values: readonly RatingBin[]): SentimentSummary {
  const summary: SentimentSummary = { positive: 0, neutral: 0, negative: 0, total: 0 };
  for (const value of values) {
    const rating = Number(value.rating_value);
    const count = Math.max(0, Math.floor(Number(value.response_count) || 0));
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || count === 0) continue;
    if (rating >= 4) summary.positive += count;
    else if (rating === 3) summary.neutral += count;
    else summary.negative += count;
    summary.total += count;
  }
  return summary;
}

export function radarPolygonPoints(values: readonly number[], radius: number, centerX: number, centerY: number, maxValue = 5): string {
  if (values.length < 3 || radius <= 0 || maxValue <= 0) return '';
  return values.map((value, index) => {
    const angle = -Math.PI / 2 + index * 2 * Math.PI / values.length;
    const scaled = Math.max(0, Math.min(maxValue, value)) / maxValue * radius;
    return (centerX + Math.cos(angle) * scaled).toFixed(2) + ',' + (centerY + Math.sin(angle) * scaled).toFixed(2);
  }).join(' ');
}