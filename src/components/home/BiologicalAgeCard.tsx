import React, { useMemo, memo } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors, Typography, Radius, Shadow } from '../../theme';
import { AnimatedPressable } from '../ui';
import { computeBiologicalAge, type BiologicalAgeBand } from '../../utils/biologicalAge';
import type { WellnessScore } from '../../types';

type Props = {
  dateOfBirth?: string | null;
  wellnessScore: WellnessScore | null;
  heightCm?: number;
  weightKg?: number;
  onImproveScore?: () => void;
  onAddDateOfBirth?: () => void;
  onOpenVirtualTwin?: () => void;
  showAccuracyPrompt?: boolean;
};

const BIO_AGE_BG = require('../../assets/anatomy/multiple-myeloma.png');

function CardBackdrop() {
  return (
    <View style={styles.bgClip} pointerEvents="none">
      <Image source={BIO_AGE_BG} style={styles.bg} resizeMode="cover" />
      <View style={styles.scrim} />
    </View>
  );
}

const BAND_COLORS: Record<BiologicalAgeBand, string> = {
  poor: Colors.error,
  fair: '#E67E22',
  good: Colors.nutrition,
  great: Colors.success,
  excellent: '#1B7F6E',
};

export default memo(function BiologicalAgeCard({
  dateOfBirth,
  wellnessScore,
  heightCm,
  weightKg,
  onAddDateOfBirth,
  onOpenVirtualTwin,
  showAccuracyPrompt,
}: Props) {
  const result = useMemo(() => {
    if (!dateOfBirth || !wellnessScore) return null;
    return computeBiologicalAge({
      dateOfBirth,
      wellnessScore,
      heightCm,
      weightKg,
    });
  }, [dateOfBirth, wellnessScore, heightCm, weightKg]);

  if (!wellnessScore) return null;

  if (!dateOfBirth || !result) {
    return (
      <View style={styles.card}>
        <CardBackdrop />
        <View style={styles.sheet}>
          <Text style={styles.kicker}>Bio age</Text>
          <Text style={styles.emptyTitle}>Add your date of birth</Text>
          <Text style={styles.subtitle}>
            We estimate biological age from your age and wellness score.
          </Text>
          {onAddDateOfBirth ? (
            <AnimatedPressable style={styles.cta} onPress={onAddDateOfBirth}>
              <Text style={styles.ctaText}>Open Profile</Text>
              <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
            </AnimatedPressable>
          ) : null}
        </View>
      </View>
    );
  }

  const accent = BAND_COLORS[result.band];
  const ageLabel = Number.isInteger(result.biologicalAge)
    ? String(result.biologicalAge)
    : result.biologicalAge.toFixed(1);
  const deltaAbs = Math.abs(result.deltaYears).toFixed(1).replace(/\.0$/, '');
  const deltaSigned =
    (result.deltaYears > 0 ? '+' : result.deltaYears < 0 ? '−' : '') +
    Math.abs(result.deltaYears).toFixed(1).replace(/\.0$/, '');
  const deltaTone =
    result.deltaYears > 0 ? Colors.error : result.deltaYears < 0 ? Colors.success : Colors.text;
  const younger = result.deltaYears < 0;
  const comparisonLine =
    result.deltaYears === 0
      ? 'In line with your actual age'
      : `${deltaAbs} years ${younger ? 'younger' : 'older'} than your actual age`;
  const markerPct = Math.max(4, Math.min(96, Math.round(result.gaugeProgress * 100)));

  return (
    <AnimatedPressable
      onPress={onOpenVirtualTwin}
      accessibilityRole="button"
      accessibilityLabel={`Biological age ${ageLabel}. Open your virtual twin.`}
    >
      <View style={styles.card}>
        <CardBackdrop />
        <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Bio age</Text>
          <View style={[styles.bandPill, { backgroundColor: Colors.white, borderColor: accent }]}>
            <Text style={[styles.bandPillText, { color: accent }]}>{result.bandLabel}</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.ageValue}>{ageLabel}</Text>
          <View style={styles.heroMeta}>
            <Text style={styles.ageUnit}>years</Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              {comparisonLine}
            </Text>
          </View>
        </View>

        <View style={styles.gaugeBlock}>
          <View style={styles.gaugeTrack}>
            <LinearGradient
              colors={['#2EDBBD', '#F5C542', '#FF7A90']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gaugeFill}
            />
            <View style={[styles.gaugeMarker, { left: `${markerPct}%` as `${number}%` }]} />
          </View>
          <View style={styles.gaugeLabels}>
            <Text style={styles.gaugeLabel}>Younger</Text>
            <Text style={styles.gaugeLabel}>Older</Text>
          </View>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statChip}>
            <Text style={styles.statLabel}>Actual</Text>
            <Text style={styles.statValue}>{result.chronologicalAge}</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statLabel}>Wellness</Text>
            <Text style={styles.statValue}>{result.wellnessScoreOverall.toFixed(1)}</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statLabel}>Delta</Text>
            <Text style={[styles.statValue, { color: deltaTone }]}>{deltaSigned}</Text>
          </View>
        </View>

        <View style={styles.cta}>
          <Ionicons name="sparkles-outline" size={15} color={Colors.primary} />
          <Text style={styles.ctaText}>Explore virtual twin</Text>
          <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
        </View>
        {showAccuracyPrompt ? (
          <Text style={styles.accuracyText}>
            Based on 10 starter questions. Answer 10 more for a more accurate biological age.
          </Text>
        ) : null}
        </View>
      </View>
    </AnimatedPressable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: 6,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  bgClip: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  bg: {
    position: 'absolute',
    width: '132%',
    height: '240%',
    left: '-16%',
    top: '-55%',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  sheet: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  bandPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  bandPillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  ageValue: {
    fontSize: 44,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -1.8,
    lineHeight: 46,
  },
  heroMeta: {
    flex: 1,
    paddingBottom: 4,
    gap: 1,
  },
  ageUnit: {
    fontSize: Typography.size.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: Typography.size.sm,
    color: Colors.text,
    lineHeight: 17,
    fontWeight: '500',
  },
  emptyTitle: {
    fontSize: Typography.size.lg,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.4,
  },
  gaugeBlock: {
    gap: 3,
  },
  gaugeTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'visible',
    backgroundColor: Colors.white,
  },
  gaugeFill: {
    ...StyleSheet.absoluteFill,
    borderRadius: 999,
    opacity: 0.85,
  },
  gaugeMarker: {
    position: 'absolute',
    top: -4,
    marginLeft: -7,
    width: 14,
    height: 16,
    borderRadius: 7,
    backgroundColor: Colors.surface,
    borderWidth: 2.5,
    borderColor: Colors.text,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  gaugeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gaugeLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.3,
  },
  statRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statChip: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.4,
  },
  cta: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  ctaText: {
    fontSize: Typography.size.sm,
    fontWeight: '700',
    color: Colors.primary,
  },
  accuracyText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    lineHeight: 16,
  },
});
