import { buildScoreProgress, formatDelta, pickBaseline, shortCategoryLabel } from './scoreProgress';
import type { WellnessScore } from '../types';

const score = (date: string, overall: number, categories: Record<string, number>): WellnessScore =>
  ({ date, overall, categories } as unknown as WellnessScore);

const today = score('2026-11-17T09:00:00Z', 7.2, { physical: 7, sleep: 8, stress: 4, nutrition: 6 });
const fiveDaysAgo = score('2026-11-12T09:00:00Z', 6.9, { physical: 6.8, sleep: 7.5, stress: 5, nutrition: 6 });
const eightDaysAgo = score('2026-11-09T09:00:00Z', 6.6, { physical: 6, sleep: 6.5, stress: 5.2, nutrition: 6.1 });

describe('scoreProgress', () => {
  it('compares with the newest score at least ~a week old', () => {
    expect(pickBaseline(today, [today, fiveDaysAgo, eightDaysAgo])).toBe(eightDaysAgo);
  });

  it('falls back to the oldest earlier score when history is short', () => {
    expect(pickBaseline(today, [today, fiveDaysAgo])).toBe(fiveDaysAgo);
    expect(pickBaseline(today, [today])).toBeNull();
  });

  it('reports the overall change and the biggest category moves', () => {
    const p = buildScoreProgress(today, [today, fiveDaysAgo, eightDaysAgo]);
    expect(p.delta).toBeCloseTo(0.6);
    expect(p.baseline?.daysAgo).toBe(8);
    expect(p.biggestGain).toMatchObject({ key: 'sleep', label: 'Sleep' });
    expect(p.biggestGain?.delta).toBeCloseTo(1.5);
    expect(p.biggestDrop).toMatchObject({ key: 'stress', label: 'Stress' });
    expect(p.trend).toEqual([6.6, 6.9, 7.2]);
  });

  it('includes categories outside the first eight, like Stress, in the focus pick', () => {
    const p = buildScoreProgress(today, []);
    expect(p.focus).toMatchObject({ key: 'stress', score: 4 });
    expect(p.baseline).toBeNull();
    expect(p.delta).toBeNull();
    expect(p.trend).toEqual([7.2]);
  });

  it('ignores tiny wobbles', () => {
    const flat = score('2026-11-09T09:00:00Z', 7.1, { physical: 6.95, sleep: 8.05, stress: 4.1, nutrition: 6 });
    const p = buildScoreProgress(today, [flat]);
    expect(p.biggestGain).toBeNull();
    expect(p.biggestDrop).toBeNull();
  });

  it('formats deltas with a sign', () => {
    expect(formatDelta(0.61)).toBe('+0.6');
    expect(formatDelta(-0.34)).toBe('−0.3');
    expect(formatDelta(0.02)).toBe('0.0');
    expect(shortCategoryLabel('Work–Life Balance')).toBe('Work–Life');
  });
});
