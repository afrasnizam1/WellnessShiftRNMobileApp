/**
 * Home "Your progress" card — answers what's CHANGED, which the Wellness Index above
 * (today's score and categories) doesn't: overall vs about a week ago, the recent
 * trend, and the categories that moved most. "What to do" lives in the score
 * improvement card further down, so this only points at the area to focus on.
 */
import React, { memo, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { format } from 'date-fns';
import { Colors, Spacing, Typography } from '../../theme';
import { AppCard, AnimatedPressable } from '../ui';
import { wellnessService } from '../../services/firebase';
import { analyticsHelper } from '../../services/analyticsHelper';
import type { WellnessScore } from '../../types';
import { buildScoreProgress, formatDelta, type CategoryMove } from '../../utils/scoreProgress';

type Props = {
  uid?: string | null;
  wellnessScore: WellnessScore | null;
  /** Bumps on pull-to-refresh. */
  refreshKey?: number;
  onOpenAnalytics: () => void;
  onTakeAssessment: () => void;
  csqScreen: string;
};

const SPARK_H = 44;
const SPARK_PAD = 5;

function ScoreProgressCard({ uid, wellnessScore, refreshKey = 0, onOpenAnalytics, onTakeAssessment, csqScreen }: Props) {
  const [history, setHistory] = useState<WellnessScore[]>([]);
  const [sparkW, setSparkW] = useState(0);

  // Re-read history only when the account, the latest score or a pull-to-refresh changes.
  useEffect(() => {
    if (!uid || !wellnessScore) {
      setHistory([]);
      return;
    }
    let cancelled = false;
    wellnessService
      .getScoreHistory(uid, 30)
      .then((rows) => {
        if (!cancelled) setHistory(rows);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, [uid, wellnessScore?.date, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const progress = useMemo(
    () => (wellnessScore ? buildScoreProgress(wellnessScore, history) : null),
    [wellnessScore, history],
  );

  if (!wellnessScore || !progress) {
    return (
      <AppCard>
        <AnimatedPressable style={styles.quizCTA} onPress={onTakeAssessment} accessibilityRole="button">
          <Ionicons name="clipboard-outline" size={18} color={Colors.primary} />
          <Text style={styles.quizCTAText}>Take the wellness assessment to get your score</Text>
          <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
        </AnimatedPressable>
      </AppCard>
    );
  }

  const { baseline, delta, trend, biggestGain, biggestDrop, focus } = progress;
  const comparisonLabel = baseline
    ? baseline.daysAgo >= 6 && baseline.daysAgo <= 8
      ? 'vs last week'
      : `since ${format(new Date(baseline.date), 'd MMM')}`
    : null;

  const openAnalytics = () => {
    analyticsHelper.trackFeatureInteraction('Score Progress', 'open_analytics', csqScreen);
    onOpenAnalytics();
  };

  return (
    <AppCard>
      <View style={styles.header}>
        <Text style={styles.title}>Your progress</Text>
        {comparisonLabel ? <Text style={styles.headerMeta}>{comparisonLabel}</Text> : null}
      </View>

      {baseline && delta != null ? (
        <View
          style={styles.heroRow}
          accessible
          accessibilityLabel={`Wellness score ${progress.current.toFixed(1)}, ${formatDelta(delta)} ${comparisonLabel}`}
        >
          <Text style={styles.heroValue}>{progress.current.toFixed(1)}</Text>
          <DeltaChip delta={delta} />
        </View>
      ) : (
        <Text style={styles.empty}>
          This is your first score. Check in again over the next few days to see what’s changing.
        </Text>
      )}

      {trend.length >= 2 ? (
        <View
          style={styles.spark}
          onLayout={(e: LayoutChangeEvent) => setSparkW(Math.round(e.nativeEvent.layout.width))}
          accessible
          accessibilityLabel={`Trend over your last ${trend.length} scores, from ${trend[0].toFixed(1)} to ${trend[
            trend.length - 1
          ].toFixed(1)}`}
        >
          {sparkW > 0 ? <Sparkline values={trend} width={sparkW} height={SPARK_H} /> : null}
        </View>
      ) : null}

      {biggestGain || biggestDrop ? (
        <View style={styles.moves}>
          {biggestGain ? <MoveRow label="Biggest gain" move={biggestGain} /> : null}
          {biggestDrop ? <MoveRow label="Slipped most" move={biggestDrop} /> : null}
        </View>
      ) : baseline ? (
        <Text style={styles.steady}>Your categories have held steady.</Text>
      ) : null}

      {focus ? (
        <View style={styles.focusRow}>
          <View style={[styles.dot, { backgroundColor: focus.color }]} />
          <Text style={styles.focusText} numberOfLines={2}>
            Focus next on <Text style={styles.strong}>{focus.label}</Text> ({focus.score.toFixed(1)}) — see
            how to improve it below.
          </Text>
        </View>
      ) : null}

      <AnimatedPressable style={styles.analyticsLink} onPress={openAnalytics} accessibilityRole="button">
        <Text style={styles.analyticsLinkText}>View full analytics</Text>
        <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
      </AnimatedPressable>
    </AppCard>
  );
}

function DeltaChip({ delta }: { delta: number }) {
  const text = formatDelta(delta);
  const flat = text === '0.0';
  const up = delta > 0;
  return (
    <View style={styles.deltaChip}>
      {flat ? null : (
        <Ionicons name={up ? 'arrow-up' : 'arrow-down'} size={13} color={up ? Colors.success : Colors.error} />
      )}
      <Text style={styles.deltaText}>{flat ? 'No change' : text}</Text>
    </View>
  );
}

function MoveRow({ label, move }: { label: string; move: CategoryMove }) {
  const up = move.delta > 0;
  return (
    <View style={styles.moveRow}>
      <Text style={styles.moveLabel}>{label}</Text>
      <View style={styles.moveValue}>
        <View style={[styles.dot, { backgroundColor: move.color }]} />
        <Text style={styles.moveName} numberOfLines={1}>
          {move.label}
        </Text>
        <Ionicons name={up ? 'arrow-up' : 'arrow-down'} size={12} color={up ? Colors.success : Colors.error} />
        <Text style={styles.moveDelta}>{formatDelta(move.delta)}</Text>
      </View>
    </View>
  );
}

/** Single-series trend line: 2px stroke, end-point marker, no axes. */
function Sparkline({ values, width, height }: { values: number[]; width: number; height: number }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(0.5, max - min); // keep tiny wobbles from looking dramatic
  const mid = (min + max) / 2;
  const lo = mid - span / 2;
  const x = (i: number) => SPARK_PAD + (i * (width - SPARK_PAD * 2)) / (values.length - 1);
  const y = (v: number) => SPARK_PAD + (1 - (v - lo) / span) * (height - SPARK_PAD * 2);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const lastX = x(values.length - 1);
  const lastY = y(values[values.length - 1]);
  return (
    <Svg width={width} height={height}>
      <Polyline
        points={points}
        fill="none"
        stroke={Colors.primary}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Circle cx={lastX} cy={lastY} r={4} fill={Colors.primary} stroke={Colors.surface} strokeWidth={2} />
    </Svg>
  );
}

export default memo(ScoreProgressCard);

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: Spacing.sm },
  title: { fontSize: Typography.size.lg, fontWeight: '700', color: Colors.text },
  headerMeta: { fontSize: Typography.size.sm, color: Colors.textSecondary },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs },
  heroValue: {
    fontSize: Typography.size['3xl'],
    fontWeight: '800',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  deltaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Colors.surfaceSecondary,
  },
  deltaText: { fontSize: Typography.size.sm, fontWeight: '700', color: Colors.text },
  empty: { fontSize: Typography.size.sm, color: Colors.textSecondary, marginTop: Spacing.xs, lineHeight: 19 },
  spark: { height: SPARK_H, marginTop: Spacing.sm },
  moves: { marginTop: Spacing.sm, gap: 6 },
  moveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  moveLabel: { fontSize: Typography.size.sm, color: Colors.textSecondary },
  moveValue: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  moveName: { fontSize: Typography.size.sm, fontWeight: '600', color: Colors.text, flexShrink: 1 },
  moveDelta: { fontSize: Typography.size.sm, fontWeight: '700', color: Colors.text, fontVariant: ['tabular-nums'] },
  steady: { fontSize: Typography.size.sm, color: Colors.textSecondary, marginTop: Spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  focusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  focusText: { flex: 1, fontSize: Typography.size.sm, color: Colors.textSecondary, lineHeight: 19 },
  strong: { fontWeight: '700', color: Colors.text },
  analyticsLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.sm, alignSelf: 'flex-start' },
  analyticsLinkText: { fontSize: Typography.size.sm, color: Colors.primary, fontWeight: '600' },
  quizCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryLight,
    borderRadius: 14,
    padding: Spacing.md,
  },
  quizCTAText: { flex: 1, fontSize: Typography.size.sm, color: Colors.primary, fontWeight: '600' },
});
