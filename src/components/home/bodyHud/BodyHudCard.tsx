/**
 * Body HUD — 3D wellness sphere and category rings.
 * Uses the same wellness score and categories as the score card below it.
 * Tapping a segment selects that category on both.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WellnessCategoryKey, WellnessScore } from '../../../types';
import { WELLNESS_CATEGORIES } from '../../../theme';
import { analyticsHelper } from '../../../services/analyticsHelper';
import { scoreLabel, scoreLabelColor } from '../../analytics/chartInteraction';
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
  up: '#34C759', // improvement reads as good news, not pink
  down: '#F2665E',
};

const HOME_CATEGORIES = WELLNESS_CATEGORIES.slice(0, HUD_CATEGORY_COUNT);
/** The drag/tap hint shows on the first visit only, then fades. */
const HINT_SEEN_KEY = 'bodyHud.hintSeen.v1';
const HINT_MS = 5000;

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
  // No pause button: the sphere follows the phone's Reduce Motion setting.
  const [paused, setPaused] = useState(false);
  const [stageW, setStageW] = useState(0);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setPaused)
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setPaused);
    return () => sub.remove();
  }, []);

  // First-visit hint ("Drag to rotate · tap an area"), faded out after a few seconds or on first tap.
  const [showHint, setShowHint] = useState(false);
  const hintOpacity = useRef(new Animated.Value(1)).current;
  const hideHint = useCallback(() => {
    Animated.timing(hintOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() =>
      setShowHint(false),
    );
    AsyncStorage.setItem(HINT_SEEN_KEY, '1').catch(() => {});
  }, [hintOpacity]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    AsyncStorage.getItem(HINT_SEEN_KEY)
      .then((seen) => {
        if (seen) return;
        setShowHint(true);
        timer = setTimeout(hideHint, HINT_MS);
      })
      .catch(() => {});
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [hideHint]);

  const focusRing = rings[selectedIndex] ?? rings[0];

  const select = useCallback(
    (index: number, source: 'sphere' | 'ring') => {
      const r = rings[index];
      if (!r?.categoryKey) return;
      // A second tap on the sphere keeps the wedge selected and facing forward.
      if (source === 'ring' || r.categoryKey !== selectedCategory) onSelectCategory(r.categoryKey);
      if (showHint) hideHint();
      analyticsHelper.trackChartCategoryTap({
        screen: csqScreen,
        chart: source === 'sphere' ? 'Body HUD Sphere' : 'Body HUD Rings',
        category: r.name,
        category_key: r.categoryKey,
      });
    },
    [rings, csqScreen, onSelectCategory, selectedCategory, showHint, hideHint],
  );
  const onSpherePick = useCallback((i: number) => select(i, 'sphere'), [select]);

  // Centre glow and status follow the overall score band (green good → red low).
  const bandColor = hasScore ? scoreLabelColor(overall) : HUD.dim;
  const focusChosen = selectedCategory != null && rings.some((r) => r.categoryKey === selectedCategory);

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
          <View style={[styles.logo, { borderColor: bandColor }]}>
            <View style={[styles.logoInner, { borderColor: bandColor }]} />
          </View>
          <View style={styles.flexShrink}>
            <Text style={styles.title} numberOfLines={1}>
              Wellness Index
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {rings.length} areas
            </Text>
          </View>
        </View>
        {!hasScore ? (
          <View style={styles.sampleBadge}>
            <Text style={styles.sampleText}>No score yet</Text>
          </View>
        ) : null}
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
        {/* Only once someone has picked an area */}
        {focusChosen ? (
          <View style={styles.chipRow} pointerEvents="none">
            <View style={styles.chip}>
              <Text style={styles.chipText}>
                Focus{' '}
                <Text style={[styles.chipStrong, { color: focusRing.color }]}>
                  {focusRing.name} {focusRing.hasData ? focusRing.valueLabel : '—'}
                </Text>
              </Text>
            </View>
          </View>
        ) : null}

        <View style={[styles.sphereSlot, { height: sphereH }]}>
          <WellnessSphereView
            pcts={pcts}
            colors={colors}
            selected={selectedIndex}
            paused={paused}
            active={focused}
            onPick={onSpherePick}
            coreColor={bandColor}
          />
          {/* The score as real text over the sphere — always sharp and read by screen readers. */}
          <View style={styles.scoreOverlay} pointerEvents="none">
            <View style={styles.scoreLine}>
              <Text style={styles.scoreNum}>{hasScore ? overall.toFixed(1) : '—'}</Text>
              <Text style={styles.scoreOf}>/10</Text>
            </View>
            {hasScore ? (
              <Text style={[styles.scoreBand, { color: bandColor }]}>{scoreLabel(overall)}</Text>
            ) : null}
            {delta != null && delta !== 0 ? (
              <Text style={[styles.delta, { color: delta > 0 ? HUD.up : HUD.down }]}>
                {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)} this week
              </Text>
            ) : null}
          </View>
        </View>

        {showHint ? (
          <Animated.View style={[styles.hintRow, { opacity: hintOpacity }]} pointerEvents="none">
            <Text style={styles.hintText}>Drag to rotate · tap an area to focus</Text>
          </Animated.View>
        ) : null}

        {/* Only good news here: hidden when zero */}
        {streakDays > 0 || closed > 0 ? (
          <View style={styles.chipRow} pointerEvents="none">
            {streakDays > 0 ? (
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  <Text style={styles.chipStrongW}>{streakDays}</Text>-day streak
                </Text>
              </View>
            ) : (
              <View />
            )}
            {closed > 0 ? (
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  <Text style={styles.chipStrongW}>
                    {closed} of {rings.length}
                  </Text>{' '}
                  areas at 10
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Category rings — same set and order as the score card */}
      <View style={styles.ringsHead}>
        <Text style={styles.ringsLabel}>Your areas</Text>
        <Text style={styles.ringsCount}>tap to focus</Text>
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
  title: { color: HUD.text, fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  sub: { color: HUD.muted, fontSize: 11, marginTop: 1 },
  sampleBadge: {
    borderWidth: 1,
    borderColor: HUD.amber + '99',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  sampleText: { color: HUD.amber, fontSize: 11, fontWeight: '700' },

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
  chipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  sphereSlot: {
    marginVertical: 6,
  },
  scoreOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreLine: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  scoreNum: {
    color: HUD.text,
    fontSize: 52,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1.5,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 12,
  },
  scoreOf: {
    color: HUD.muted,
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowRadius: 8,
  },
  scoreBand: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowRadius: 8,
  },
  delta: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowRadius: 8,
  },
  hintRow: { alignItems: 'center', marginBottom: 6 },
  hintText: { color: HUD.dim, fontSize: 11.5 },
  chip: {
    backgroundColor: HUD.chip,
    borderWidth: 1,
    borderColor: HUD.line2,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
    flexShrink: 1,
  },
  chipText: { color: HUD.muted, fontSize: 11.5 },
  chipStrong: { fontWeight: '700' },
  chipStrongW: { color: HUD.text, fontWeight: '700' },


  ringsHead: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, marginBottom: 6 },
  ringsLabel: { color: HUD.muted, fontSize: 12, fontWeight: '600' },
  ringsCount: { color: HUD.dim, fontSize: 12 },
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
