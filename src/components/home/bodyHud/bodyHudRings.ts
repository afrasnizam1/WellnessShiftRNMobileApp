/**
 * Wellness Index rings — one per home wellness category, read from the same
 * wellness score the score card uses, so both always show the same numbers.
 */
import type { WellnessCategoryKey, WellnessCategoryScores } from '../../../types';
import { WELLNESS_CATEGORIES } from '../../../theme';

export type HudRing = {
  id: string;
  categoryKey?: WellnessCategoryKey;
  name: string;
  color: string;
  /** 0–1 (score out of 10). */
  pct: number;
  /** e.g. "7.4"; "—" when the category has no score. */
  valueLabel: string;
  goalLabel: string;
  hasData: boolean;
};

export function hudRingsClosed(rings: HudRing[]): number {
  return rings.filter((r) => r.pct >= 1).length;
}

/**
 * Every wellness category is shown. The overall score averages all of them, so
 * showing fewer would make the overall look wrong. The 3D sphere has one segment each.
 */
export const HUD_CATEGORY_COUNT = WELLNESS_CATEGORIES.length;

export type CategoryHudSource = {
  key: WellnessCategoryKey;
  label: string;
  color: string;
};

/** Same shortening as the score list beside the orbit ring. */
export function categoryHudLabel(label: string): string {
  return label
    .replace(' Health', '')
    .replace(' Wellness', '')
    .replace(' Management', '')
    .replace('Environmental', 'Environment')
    .replace('Work–Life Balance', 'Work–Life');
}

/**
 * One ring per home wellness category. A score of 10 fills the ring.
 * Missing scores stay empty rather than inventing a value.
 */
export function buildCategoryHudRings(
  categories: CategoryHudSource[],
  scores: Partial<WellnessCategoryScores> | undefined,
): HudRing[] {
  return categories.map((cat) => {
    const raw = scores?.[cat.key];
    const hasData = typeof raw === 'number' && Number.isFinite(raw);
    const score = hasData ? Math.max(0, Math.min(10, raw as number)) : 0;
    return {
      id: cat.key,
      categoryKey: cat.key,
      name: categoryHudLabel(cat.label),
      color: cat.color,
      pct: hasData ? score / 10 : 0,
      valueLabel: hasData ? score.toFixed(1) : '—',
      goalLabel: 'of 10',
      hasData,
    };
  });
}

/** Wellness overall is 0–10. The history chip stores the same score on a 0–100 scale. */
export function wellnessScoreOutOf100(overall: number | undefined): number {
  if (typeof overall !== 'number' || !Number.isFinite(overall)) return 0;
  return Math.round(Math.max(0, Math.min(10, overall)) * 10);
}
