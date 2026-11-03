import { describe, expect, it } from 'vitest';
import { buildRatingDonutSegments, radarPolygonPoints, summarizeCategoryPerformance, summarizeRatingSentiment } from '../lib/analytics-visuals';

describe('privacy-suppressed analytics visual models', () => {
  it('builds donut segments only from valid visible rating bins', () => {
    const donut = buildRatingDonutSegments([{rating_value:1,response_count:5},{rating_value:2,response_count:0},{rating_value:5,response_count:10},{rating_value:9,response_count:50}]);
    expect(donut.total).toBe(15);
    expect(donut.segments.map(item => item.rating)).toEqual([1,5]);
    expect(donut.segments[0].start).toBe(0);
    expect(donut.segments[1].end).toBe(100);
    expect(donut.gradient).toContain('conic-gradient');
  });
  it('groups real ratings into positive, neutral and negative counts', () => {
    expect(summarizeRatingSentiment([{rating_value:1,response_count:5},{rating_value:2,response_count:7},{rating_value:3,response_count:8},{rating_value:4,response_count:10},{rating_value:5,response_count:12}])).toEqual({positive:22,neutral:8,negative:12,total:42});
  });
  it('uses only rating questions and reportable groups for category weighted averages', () => {
    const performance=summarizeCategoryPerformance([
      {question_category:'Teaching Effectiveness',question_type:'rating',avg_numeric_value:4,response_count:10},
      {question_category:'Teaching Effectiveness',question_type:'rating',avg_numeric_value:3,response_count:5},
      {question_category:'Teaching Effectiveness',question_type:'number',avg_numeric_value:100,response_count:50},
      {question_category:'Course Content',question_type:'rating',avg_numeric_value:5,response_count:4}
    ]);
    expect(performance).toEqual([{category:'Teaching Effectiveness',average:3.6666666666666665,response_count:15}]);
  });
  it('creates radar polygons only for at least three axes and bounds scores to 1–5', () => {
    expect(radarPolygonPoints([5,5],80,100,100)).toBe('');
    expect(radarPolygonPoints([5,0,2.5],80,100,100).split(' ')).toHaveLength(3);
    expect(radarPolygonPoints([5,0,2.5],80,100,100)).toContain('100.00,20.00');
  });
});