/**
 * Wellness score orbit ring + category list (moved from Home to Analytics).
 * Shows every wellness category — the same ones the overall score averages — and
 * drives the dashboard's category selection when a ring or row is tapped.
 */
import React, { memo, useCallback } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import WellnessOrbitRing, { getOrbitPanelSize } from '../home/WellnessOrbitRing';
import CategoryScoreRow from '../home/CategoryScoreRow';
import { useWellnessScoreChangeFeedback } from '../../hooks/useWellnessScoreChangeFeedback';
import { Colors, Radius, Spacing, Typography, WELLNESS_CATEGORIES } from '../../theme';
import { scoreLabel, scoreLabelColor } from './chartInteraction';
import type { WellnessCategoryKey, WellnessScore } from '../../types';

type Props = {
  wellnessScore: WellnessScore;
  selectedCategory: WellnessCategoryKey | null;
  /** Called with null when the ring centre is tapped (clear selection). */
  onSelectCategory: (key: WellnessCategoryKey | null, chart: string) => void;
  csqScreen: string;
};

const BASE_RING = 162;
const LIST_WIDTH = 168; // room for full names like "Environmental"

function WellnessScoreRingCard({ wellnessScore, selectedCategory, onSelectCategory, csqScreen }: Props) {
  const focused = useIsFocused();
  const feedback = useWellnessScoreChangeFeedback(wellnessScore);
  const { width } = useWindowDimensions();

  // Same sizing as the old Home card: shrink the ring on narrow phones so ring + list fit.
  const natural = getOrbitPanelSize(BASE_RING) + Spacing.sm + LIST_WIDTH;
  const ringSize = Math.round(BASE_RING * Math.min(1, (width - 68) / natural));

  const ringAnalytics = { screen: csqScreen, chart: 'Wellness Ring' } as const;
  const listAnalytics = { screen: csqScreen, chart: 'Category List' } as const;

  const toggle = useCallback(
    (key: WellnessCategoryKey, chart: string) => onSelectCategory(selectedCategory === key ? null : key, chart),
    [onSelectCategory, selectedCategory],
  );

  const overall = wellnessScore.overall;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Wellness score</Text>
        <Text style={[styles.status, { color: scoreLabelColor(overall) }]}>{scoreLabel(overall)}</Text>
      </View>
      <View style={styles.row}>
        <WellnessOrbitRing
          score={overall}
          categories={wellnessScore.categories}
          size={ringSize}
          spin={focused}
          selectedCategory={selectedCategory}
          onCategorySelect={(key) => toggle(key, 'Wellness Ring')}
          onCenterPress={() => onSelectCategory(null, 'Wellness Ring')}
          analytics={ringAnalytics}
          scoreFeedback={feedback}
        />
        <View style={styles.list}>
          {WELLNESS_CATEGORIES.map((cat) => (
            <CategoryScoreRow
              key={cat.key}
              cat={cat}
              score={wellnessScore.categories?.[cat.key as WellnessCategoryKey] ?? 0}
              isSelected={selectedCategory === cat.key}
              feedback={feedback}
              analytics={listAnalytics}
              onPress={(key) => toggle(key, 'Category List')}
            />
          ))}
        </View>
      </View>
      <Text style={styles.hint}>Tap a ring or category to filter the charts below.</Text>
    </View>
  );
}

export default memo(WellnessScoreRingCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.sm,
    paddingLeft: Spacing.sm,
    paddingRight: Spacing.lg,
    overflow: 'visible',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingLeft: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  title: { fontSize: Typography.size.lg, fontWeight: '700', color: Colors.text, letterSpacing: -0.3 },
  status: { fontSize: Typography.size.sm, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, overflow: 'visible' },
  list: { flex: 1, gap: 2, minWidth: 0 },
  hint: {
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
    paddingLeft: Spacing.sm,
    marginTop: Spacing.xs,
  },
});
