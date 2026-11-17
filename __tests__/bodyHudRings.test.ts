import {
  HUD_CATEGORY_COUNT,
  buildCategoryHudRings,
  categoryHudLabel,
  hudRingsClosed,
  wellnessScoreOutOf100,
} from '../src/components/home/bodyHud/bodyHudRings';
import { WELLNESS_CATEGORIES } from '../src/theme';
import type { WellnessCategoryKey } from '../src/types';

const cats = WELLNESS_CATEGORIES.map((c) => ({
  key: c.key as WellnessCategoryKey,
  label: c.label,
  color: c.color,
}));

describe('Wellness Index rings', () => {
  it('shows every category the overall score averages', () => {
    expect(HUD_CATEGORY_COUNT).toBe(8);
    const rings = buildCategoryHudRings(cats.slice(0, HUD_CATEGORY_COUNT), {});
    expect(rings.map((r) => r.categoryKey)).toEqual(
      WELLNESS_CATEGORIES.slice(0, HUD_CATEGORY_COUNT).map((c) => c.key),
    );
  });

  it('fills rings from the same category scores as the home score', () => {
    const rings = buildCategoryHudRings(cats.slice(0, 3), { physical: 8, nutrition: 10, mental: 0 });
    expect(rings.map((r) => r.name)).toEqual(['Physical', 'Nutrition', 'Mental']);
    expect(rings[0]).toMatchObject({ categoryKey: 'physical', valueLabel: '8.0', pct: 0.8, hasData: true });
    expect(rings[1].pct).toBe(1);
    expect(rings[2]).toMatchObject({ hasData: true, valueLabel: '0.0', pct: 0 });
    expect(hudRingsClosed(rings)).toBe(1);
  });

  it('never invents a value for a missing category', () => {
    const sleep = buildCategoryHudRings(cats, { physical: 7 }).find((r) => r.categoryKey === 'sleep')!;
    expect(sleep).toMatchObject({ hasData: false, pct: 0, valueLabel: '—' });
  });

  it('shortens labels like the score list', () => {
    expect(categoryHudLabel('Stress Management')).toBe('Stress');
    expect(categoryHudLabel('Work–Life Balance')).toBe('Work–Life');
    expect(categoryHudLabel('Environmental')).toBe('Environment');
  });

  it('converts the overall score for the week-over-week chip', () => {
    expect(wellnessScoreOutOf100(8.4)).toBe(84);
    expect(wellnessScoreOutOf100(undefined)).toBe(0);
  });
});
