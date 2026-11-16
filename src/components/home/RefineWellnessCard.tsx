import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../theme';
import { AnimatedPressable } from '../ui';

type Props = {
  onStart: () => void;
  onLater?: () => void;
};

export default function RefineWellnessCard({ onStart, onLater }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.kickerRow}>
        <Ionicons name="sparkles" size={14} color={Colors.primary} />
        <Text style={styles.kicker}>More accurate score & age</Text>
      </View>
      <Text style={styles.title}>Want a more accurate wellness score and biological age?</Text>
      <Text style={styles.body}>
        Your current numbers come from 10 starter questions. Answer 10 more to refine every
        category — sleep, stress, fitness, and the rest. That combined picture is what updates
        your wellness score and biological age.
      </Text>
      <AnimatedPressable
        style={styles.cta}
        onPress={onStart}
        accessibilityRole="button"
        accessibilityLabel="Answer 10 more questions for a more accurate wellness score and biological age"
      >
        <Text style={styles.ctaText}>Answer 10 more questions</Text>
        <Ionicons name="arrow-forward" size={16} color={Colors.white} />
      </AnimatedPressable>
      {onLater ? (
        <AnimatedPressable
          onPress={onLater}
          accessibilityRole="button"
          accessibilityLabel="Skip extra questions for now"
        >
          <Text style={styles.later}>Skip for now — you can do this anytime</Text>
        </AnimatedPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.primaryLight,
    ...Shadow.sm,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: Typography.size.lg,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.4,
    lineHeight: 24,
  },
  body: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    fontWeight: '500',
  },
  cta: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingVertical: 12,
    paddingHorizontal: Spacing.base,
  },
  ctaText: {
    fontSize: Typography.size.sm,
    fontWeight: '800',
    color: Colors.white,
  },
  later: {
    textAlign: 'center',
    fontSize: Typography.size.xs,
    fontWeight: '600',
    color: Colors.textTertiary,
    paddingVertical: 4,
  },
});
