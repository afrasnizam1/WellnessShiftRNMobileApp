/**
 * "What's changed" for the Home progress card: today's wellness score against the
 * score from about a week ago, the overall trend, and which categories moved most.
 * Uses every wellness category (all ten), the same ones the overall score averages.
 */
import { WELLNESS_CATEGORIES } from '../theme';
import type { WellnessCategoryKey, WellnessScore } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;
/** A change smaller than this (0–10 scale) is treated as "no real change". */
export const MEANINGFUL_DELTA = 0.2;

export type CategoryMove = {
  key: WellnessCategoryKey;
  label: string;
  color: string;
  from: number;
  to: number;
  delta: number;
};

export type ScoreProgress = {
  current: number;
  /** Null when there's no earlier score to compare with. */
  baseline: { overall: number; date: string; daysAgo: number } | null;
  delta: number | null;
  /** Oldest → newest overall scores for the trend line (includes the current score). */
  trend: number[];
  biggestGain: CategoryMove | null;
  biggestDrop: CategoryMove | null;
  /** Lowest-scoring category now (for the "focus next" line). */
  focus: { key: WellnessCategoryKey; label: string; color: string; score: number } | null;
};

function time(score: WellnessScore): number {
  const t = Date.parse(score.date);
  return Number.isFinite(t) ? t : 0;
}

/** Short category names, matching the Wellness Index tiles. */
export function shortCategoryLabel(label: string): string {
  return label
    .replace(' Health', '')
    .replace(' Wellness', '')
    .replace(' Management', '')
    .replace('Environmental', 'Environment')
    .replace('Work–Life Balance', 'Work–Life');
}

/**
 * Picks the comparison score: the newest one at least 6 days older than `current`.
 * If the history doesn't reach back that far, the oldest earlier score is used
 * (the card then says "since <date>" rather than "vs last week").
 */
export function pickBaseline(current: WellnessScore, history: WellnessScore[]): WellnessScore | null {
  const now = time(current);
  const earlier = history
    .filter((s) => time(s) > 0 && time(s) < now)
    .sort((a, b) => time(b) - time(a));
  if (!earlier.length) return null;
  return earlier.find((s) => now - time(s) >= 6 * DAY_MS) ?? earlier[earlier.length - 1];
}

export function buildScoreProgress(
  current: WellnessScore,
  history: WellnessScore[],
  trendPoints = 14,
): ScoreProgress {
  const baselineScore = pickBaseline(current, history);
  const now = time(current);

  const moves: CategoryMove[] = [];
  if (baselineScore) {
    for (const cat of WELLNESS_CATEGORIES) {
      const key = cat.key as WellnessCategoryKey;
      const from = baselineScore.categories?.[key];
      const to = current.categories?.[key];
      if (typeof from !== 'number' || typeof to !== 'number') continue;
      moves.push({ key, label: shortCategoryLabel(cat.label), color: cat.color, from, to, delta: to - from });
    }
  }
  const byDelta = [...moves].sort((a, b) => b.delta - a.delta);
  const gain = byDelta[0];
  const drop = byDelta[byDelta.length - 1];

  let focus: ScoreProgress['focus'] = null;
  for (const cat of WELLNESS_CATEGORIES) {
    const key = cat.key as WellnessCategoryKey;
    const score = current.categories?.[key];
    if (typeof score !== 'number') continue;
    if (!focus || score < focus.score) {
      focus = { key, label: shortCategoryLabel(cat.label), color: cat.color, score };
    }
  }

  const trend = [...history.filter((s) => time(s) > 0 && time(s) < now), current]
    .sort((a, b) => time(a) - time(b))
    .slice(-trendPoints)
    .map((s) => s.overall);

  return {
    current: current.overall,
    baseline: baselineScore
      ? {
          overall: baselineScore.overall,
          date: baselineScore.date,
          daysAgo: Math.max(1, Math.round((now - time(baselineScore)) / DAY_MS)),
        }
      : null,
    delta: baselineScore ? current.overall - baselineScore.overall : null,
    trend,
    biggestGain: gain && gain.delta >= MEANINGFUL_DELTA ? gain : null,
    biggestDrop: drop && drop.delta <= -MEANINGFUL_DELTA ? drop : null,
    focus,
  };
}

/** "+0.6", "−0.3", "0.0" — signed, one decimal, with a real minus sign. */
export function formatDelta(delta: number): string {
  const rounded = Math.round(delta * 10) / 10;
  if (rounded === 0) return '0.0';
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(1)}`;
}
