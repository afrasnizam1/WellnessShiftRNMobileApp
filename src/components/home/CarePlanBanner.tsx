// src/components/home/CarePlanBanner.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../theme';
import { AnimatedPressable } from '../ui';
import type { CarePlan } from '../../types';

interface Props {
  carePlan: CarePlan;
  onPress: () => void;
  isNew?: boolean;
}

export default function CarePlanBanner({ carePlan, onPress, isNew = false }: Props) {
  const pendingCount = carePlan.tasks.filter((t) => !t.isComplete).length;
  const fromLabel = carePlan.clinicianName
    ? `From ${carePlan.clinicianName}`
    : 'From your clinician';
  const meta =
    pendingCount > 0
      ? `${fromLabel} · ${pendingCount} pending`
      : fromLabel;

  const subtitle = isNew ? `${carePlan.title} · ${meta}` : meta;

  const nextTask = carePlan.tasks.find((task) => !task.isComplete);
  const preview = nextTask?.title?.trim();

  return (
    <AnimatedPressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Open care plan">
      <View style={styles.card}>
        <LinearGradient
          colors={['#F7F4FF', '#F3EEFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient colors={[Colors.purple, Colors.purpleLight]} style={styles.iconWrap}>
          <Ionicons name="clipboard" size={16} color={Colors.white} />
        </LinearGradient>
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {isNew ? 'New care plan' : carePlan.title}
            </Text>
            {isNew ? (
              <View style={styles.newPill}>
                <Text style={styles.newPillText}>New</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
          {preview ? (
            <Text style={styles.preview} numberOfLines={1}>
              Next: {preview}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.lg,
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(140, 89, 191, 0.22)',
    overflow: 'hidden',
    ...Shadow.sm,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: {
    flexShrink: 1,
    fontSize: Typography.size.sm,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  newPill: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: 'rgba(140, 89, 191, 0.14)',
  },
  newPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.purple,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: Typography.size.xs,
    lineHeight: 16,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  preview: {
    fontSize: Typography.size.xs,
    lineHeight: 16,
    color: Colors.text,
    fontWeight: '600',
    marginTop: 1,
  },
});
