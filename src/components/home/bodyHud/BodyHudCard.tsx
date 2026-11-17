/**
 * Body HUD — 3D wellness sphere and category rings.
 * Uses the same wellness score and categories as the score card below it.
 * Tapping a segment selects that category on both.
 */
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import type { WellnessCategoryKey, WellnessScore } from '../../../types';
import { WELLNESS_CATEGORIES } from '../../../theme';
import { analyticsHelper } from '../../../services/analyticsHelper';
import WellnessSphereView from './WellnessSphereView';
import {
  HUD_CATEGORY_COUNT,
  buildCategoryHudRings,
  hudRingsClosed,
  wellnessScoreOutOf100,
  type HudRing,
} from './bodyHudRings';
import { useWeekOverWeek } from './useBodyHudData';

type Props = {
  uid?: string | null;
  wellnessScore: WellnessScore | null;
  selectedCategory: WellnessCategoryKey | null;
  onSelectCategory: (key: WellnessCategoryKey) => void;
  streakDays: number;
  /** Home is the visible screen — drives spin + data refresh. */
  focused: boolean;
  refreshKey?: number;
  /** CSQ screen name for tap events. */
  csqScreen: string;
};

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });
const HUD = {
  card: '#0F1118',
  stage: '#07080D',
  line: 'rgba(255,255,255,0.09)',
  line2: 'rgba(255,255,255,0.16)',
  chip: 'rgba(15,17,24,0.88)',
  text: '#F5F7FA',
  muted: '#A3ACB9',
  dim: '#6B7380',
  track: '#1A1F29',
  accent: '#EC4F96',
  amber: '#F7B267',
  up: '#EC4F96',
  down: '#F2665E',
};

const HOME_CATEGORIES = WELLNESS_CATEGORIES.slice(0, HUD_CATEGORY_COUNT);

function BodyHudCard({
  uid,
  wellnessScore,
  selectedCategory,
  onSelectCategory,
  streakDays,
  focused,
  csqScreen,
}: Props) {
  const rings = useMemo(
    () =>
      buildCategoryHudRings(
        HOME_CATEGORIES.map((cat) => ({
          key: cat.key as WellnessCategoryKey,
          label: cat.label,
          color: cat.color,
        })),
        wellnessScore?.categories,
      ),
    [wellnessScore?.categories],
  );
  const pcts = useMemo(() => rings.map((r) => r.pct), [rings]);
  const colors = useMemo(() => rings.map((r) => r.color), [rings]);
  const hasScore = wellnessScore != null;
  const overall = hasScore ? Math.max(0, Math.min(10, wellnessScore.overall)) : 0;
  const closed = hudRingsClosed(rings);
  const weekDelta = useWeekOverWeek(uid, wellnessScoreOutOf100(wellnessScore?.overall), hasScore);
  const delta = weekDelta == null ? null : weekDelta / 10;

  const selectedIndex = Math.max(
    0,
    rings.findIndex((r) => r.categoryKey === selectedCategory),
  );
  const [paused, setPaused] = useState(false);
  const [stageW, setStageW] = useState(0);

  useEffect(() => {
    // Respect Reduce Motion — start paused, the user can still spin it.
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => on && setPaused(true))
      .catch(() => {});
  }, []);

  const focusRing = rings[selectedIndex] ?? rings[0];

  const select = useCallback(
    (index: number, source: 'sphere' | 'ring') => {
      const r = rings[index];
      if (!r?.categoryKey) return;
      // A second tap on the sphere keeps the wedge selected and facing forward.
      if (source === 'ring' || r.categoryKey !== selectedCategory) onSelectCategory(r.categoryKey);
      analyticsHelper.trackChartCategoryTap({
        screen: csqScreen,
        chart: source === 'sphere' ? 'Body HUD Sphere' : 'Body HUD Rings',
        category: r.name,
        category_key: r.categoryKey,
      });
    },
    [rings, csqScreen, onSelectCategory, selectedCategory],
  );
  const onSpherePick = useCallback((i: number) => select(i, 'sphere'), [select]);

  const togglePause = useCallback(() => {
    setPaused((p) => {
      analyticsHelper.trackFeatureInteraction('Body HUD', p ? 'resume_spin' : 'pause_spin', csqScreen);
      return !p;
    });
  }, [csqScreen]);

  const onStageLayout = (e: LayoutChangeEvent) => setStageW(Math.round(e.nativeEvent.layout.width));
  // Sphere sits in its own slot. Labels live in bands above and below it,
  // so they never paint over the ring or the core.
  const sphereH = stageW ? Math.round(Math.min(stageW * 0.9, 400)) : 300;

  const missing = hasScore ? rings.filter((r) => !r.hasData).map((r) => r.name) : [];

  return (
    <View style={styles.card} accessibilityLabel="Wellness Index">
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <View style={styles.logoInner} />
          </View>
          <View style={styles.flexShrink}>
            <Text style={styles.title} numberOfLines={1}>
              WELLNESS INDEX
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              composite of 8 domains
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {hasScore ? (
            <View style={styles.syncRow}>
              <View style={styles.syncDot} />
              <Text style={styles.syncText} numberOfLines={1}>
                Linked to score
              </Text>
            </View>
          ) : (
            <View style={styles.sampleBadge}>
              <Text style={styles.sampleText}>NO SCORE YET</Text>
            </View>
          )}
          <Pressable
            onPress={togglePause}
            style={({ pressed }) => [styles.pauseBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={paused ? 'Resume sphere spin' : 'Pause sphere spin'}
            testID="body_hud_pause_spin"
          >
            <Text style={styles.pauseText}>{paused ? 'Resume spin' : 'Pause spin'}</Text>
          </Pressable>
        </View>
      </View>

      {/* Sphere stage */}
      <View
        style={styles.stage}
        onLayout={onStageLayout}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`3D wellness sphere. ${rings
          .map((r) => `${r.name} ${r.hasData ? r.valueLabel : 'no score'} out of 10`)
          .join(', ')}. Wellness score ${hasScore ? overall.toFixed(1) : 'not set'} out of 10.`}
      >
        <View style={styles.stageHead} pointerEvents="none">
          <Text style={styles.stageLabel}>WELLNESS SPHERE · 3D</Text>
          <Text style={styles.stageLabelR}>tap a segment to focus</Text>
        </View>

        <View style={styles.chipRow} pointerEvents="none">
          <View style={styles.chip}>
            <Text style={styles.chipText}>
              FOCUS{' '}
              <Text style={[styles.chipStrong, { color: focusRing.color }]}>
                {focusRing.name.toUpperCase()} {focusRing.hasData ? focusRing.valueLabel : '—'}
              </Text>
            </Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipText}>
              <Text style={styles.chipStrongW}>DRAG</Text> to rotate
            </Text>
          </View>
        </View>

        <View style={[styles.sphereSlot, { height: sphereH }]}>
          <WellnessSphereView
            pcts={pcts}
            colors={colors}
            selected={selectedIndex}
            paused={paused}
            active={focused}
            onPick={onSpherePick}
          />
        </View>

        <View style={styles.chipRow} pointerEvents="none">
          <View style={styles.chip}>
            <Text style={styles.chipText}>
              STREAK <Text style={styles.chipStrongW}>{streakDays} {streakDays === 1 ? 'day' : 'days'}</Text>
            </Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipText}>
              AT 10 <Text style={styles.chipStrongW}>{closed} / {rings.length}</Text>
            </Text>
          </View>
        </View>
      </View>

      {/* Score */}
      <View style={styles.scoreRow} accessible accessibilityLabel={`Wellness score ${hasScore ? overall.toFixed(1) : 'not set'} out of 10`}>
        <Text style={styles.scoreLabel}>WELLNESS SCORE</Text>
        <Text style={styles.scoreNum}>{hasScore ? overall.toFixed(1) : '—'}</Text>
        <Text style={styles.scoreOf}>/ 10</Text>
        {delta != null && delta !== 0 ? (
          <Text style={[styles.delta, { color: delta > 0 ? HUD.up : HUD.down }]}>
            {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)} vs last week
          </Text>
        ) : null}
      </View>

      {/* Category rings — same set and order as the score card */}
      <View style={styles.ringsHead}>
        <Text style={styles.ringsLabel}>CATEGORIES</Text>
        <Text style={styles.ringsCount}>{rings.length} linked</Text>
      </View>
      <View style={styles.grid}>
        {rings.map((r, i) => (
          <RingTile
            key={r.id}
            ring={r}
            selected={r.categoryKey === selectedCategory}
            onPress={() => select(i, 'ring')}
          />
        ))}
      </View>

      {/* Footer note */}
      {!hasScore ? (
        <Text style={[styles.footNote, styles.footSolo]}>
          Take the wellness assessment to fill the sphere from your category scores.
        </Text>
      ) : missing.length ? (
        <Text style={[styles.footNote, styles.footSolo]}>
          No score yet for {joinNames(missing)}.
        </Text>
      ) : null}
    </View>
  );
}

const RingTile = memo(function RingTile({
  ring,
  selected,
  onPress,
}: {
  ring: HudRing;
  selected: boolean;
  onPress: () => void;
}) {
  const pct = Math.round(ring.pct * 100);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        selected && { borderColor: ring.color + 'AA', backgroundColor: ring.color + '1F' },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${ring.name}: ${ring.hasData ? `${ring.valueLabel} out of 10` : 'no score'}`}
      testID={`body_hud_ring_${ring.id}`}
    >
      <View style={styles.tileTop}>
        <View style={styles.tileName}>
          <View style={[styles.dot, { backgroundColor: ring.color }]} />
          <Text style={styles.tileNameText} numberOfLines={1}>
            {ring.name}
          </Text>
        </View>
        <Text style={[styles.tilePct, { color: ring.hasData ? ring.color : HUD.dim }]}>
          {ring.hasData ? ring.valueLabel : '—'}
        </Text>
      </View>
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: ring.color }]} />
      </View>
    </Pressable>
  );
});

function joinNames(names: string[]): string {
  const lower = names.map((n) => (n === 'HRV' ? n : n.toLowerCase()));
  if (lower.length <= 1) return lower.join('');
  return `${lower.slice(0, -1).join(', ')} or ${lower[lower.length - 1]}`;
}

export default memo(BodyHudCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: HUD.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: HUD.line,
    padding: 14,
    overflow: 'hidden',
  },
  flexShrink: { flexShrink: 1 },
  pressed: { opacity: 0.75 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  logo: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: HUD.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInner: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: HUD.accent },
  title: { color: HUD.text, fontSize: 14, fontWeight: '800', letterSpacing: 1.2 },
  sub: { color: HUD.muted, fontSize: 11, marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sampleBadge: {
    borderWidth: 1,
    borderColor: HUD.amber + '99',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  sampleText: { color: HUD.amber, fontSize: 9.5, fontWeight: '700', letterSpacing: 1, fontFamily: MONO },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  syncDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: HUD.accent },
  syncText: { color: HUD.muted, fontSize: 11 },
  pauseBtn: {
    borderWidth: 1,
    borderColor: HUD.line2,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    minHeight: 34,
    justifyContent: 'center',
  },
  pauseText: { color: HUD.text, fontSize: 12, fontWeight: '600' },

  stage: {
    backgroundColor: HUD.stage,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HUD.line,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 10,
  },
  stageHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  stageLabel: { color: HUD.muted, fontSize: 9.5, letterSpacing: 1.2, fontFamily: MONO, flexShrink: 1 },
  stageLabelR: { color: HUD.dim, fontSize: 9.5, fontFamily: MONO, flexShrink: 1, textAlign: 'right' },
  chipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  sphereSlot: {
    marginVertical: 8,
  },
  chip: {
    backgroundColor: HUD.chip,
    borderWidth: 1,
    borderColor: HUD.line2,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
    flexShrink: 1,
  },
  chipText: { color: HUD.muted, fontSize: 9.5, letterSpacing: 0.6, fontFamily: MONO },
  chipStrong: { fontWeight: '700' },
  chipStrongW: { color: HUD.text, fontWeight: '700' },

  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 5,
    paddingTop: 8,
    paddingBottom: 2,
  },
  scoreLabel: { color: HUD.muted, fontSize: 10, letterSpacing: 1.4, fontFamily: MONO },
  scoreNum: { color: HUD.text, fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.6 },
  scoreOf: { color: HUD.muted, fontSize: 12 },
  delta: { fontSize: 12, fontWeight: '600', marginLeft: 4 },

  ringsHead: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, marginBottom: 6 },
  ringsLabel: { color: HUD.muted, fontSize: 10, letterSpacing: 1.4, fontFamily: MONO },
  ringsCount: { color: HUD.dim, fontSize: 10, fontFamily: MONO },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 6 },
  tile: {
    width: '48.8%',
    borderWidth: 1,
    borderColor: HUD.line,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  tileName: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  tileNameText: { color: HUD.text, fontSize: 12, fontWeight: '700', flexShrink: 1 },
  tilePct: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  bar: { height: 3, borderRadius: 2, backgroundColor: HUD.track, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2 },

  footNote: { color: HUD.dim, fontSize: 11.5, lineHeight: 16, flex: 1 },
  footSolo: { marginTop: 12 },
});
