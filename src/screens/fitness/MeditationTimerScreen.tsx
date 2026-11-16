// src/screens/fitness/MeditationTimerScreen.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors, Typography, Spacing, Radius, tabBarScrollPadding } from '../../theme';
import AppScreen from '../../components/common/AppScreen';
import { IconBadge } from '../../components/ui';
import { getMeditationCue, MEDITATION_TECHNIQUES } from '../../data/guidedSessionContent';

const DURATIONS = [3, 5, 10, 15, 20, 30];

export default function MeditationTimerScreen() {
  const navigation = useNavigation<any>();
  const [duration, setDuration] = useState(5);
  const [technique, setTechnique] = useState(MEDITATION_TECHNIQUES[0]);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [complete, setComplete] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const total = duration * 60;
  const remaining = Math.max(0, total - elapsed);
  const progress = total > 0 ? elapsed / total : 0;

  const guidanceText = useMemo(
    () => getMeditationCue(technique.id, elapsed, total),
    [technique.id, elapsed, total],
  );

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed((e) => {
          if (e + 1 >= total) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setRunning(false);
            setComplete(true);
            return total;
          }
          return e + 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, total]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const reset = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    setElapsed(0);
    setComplete(false);
  };

  return (
    <AppScreen>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { reset(); navigation.goBack(); }} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meditation</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!running && !complete && (
          <>
            <Text style={styles.sectionLabel}>Duration (minutes)</Text>
            <View style={styles.durationRow}>
              {DURATIONS.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.durationChip, duration === d && styles.durationChipActive]}
                  onPress={() => setDuration(d)}
                >
                  <Text style={[styles.durationText, duration === d && styles.durationTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Technique</Text>
            <View style={styles.techGrid}>
              {MEDITATION_TECHNIQUES.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.techCard, technique.id === t.id && styles.techCardActive]}
                  onPress={() => setTechnique(t)}
                >
                  <IconBadge name={t.icon} color={Colors.mindfulness} size="md" variant="plain" />
                  <Text style={[styles.techName, technique.id === t.id && styles.techNameActive]}>{t.name}</Text>
                  <Text style={styles.techDesc}>{t.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <View style={styles.timerWrap}>
          <View style={styles.timerCircle}>
            {!complete && (
              <IconBadge name={technique.icon} color={Colors.mindfulness} size="lg" variant="plain" />
            )}
            <Text style={styles.timerTime}>{formatTime(remaining)}</Text>
            <Text style={styles.timerLabel}>
              {complete ? 'Session complete' : running ? technique.name : `${duration} min session`}
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>

        {(running || complete) && (
          <View style={styles.guidanceCard}>
            <Text style={styles.guidanceText}>{guidanceText}</Text>
          </View>
        )}

        {complete && (
          <View style={styles.completeCard}>
            <Text style={styles.completeTitle}>Well done</Text>
            <Text style={styles.completeSub}>
              You completed {duration} minutes of {technique.name.toLowerCase()}. Consistency builds calm — return tomorrow.
            </Text>
          </View>
        )}

        <View style={styles.controls}>
          {!complete ? (
            <>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: running ? Colors.warning : Colors.mindfulness }]}
                onPress={() => setRunning((r) => !r)}
              >
                <Text style={styles.primaryBtnText}>{running ? 'Pause' : elapsed > 0 ? 'Resume' : 'Begin session'}</Text>
              </TouchableOpacity>
              {elapsed > 0 && (
                <TouchableOpacity style={styles.secondaryBtn} onPress={reset}>
                  <Text style={styles.secondaryBtnText}>Reset</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: Colors.success }]} onPress={reset}>
              <Text style={styles.primaryBtnText}>New session</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  backBtn: { width: 40 },
  backText: { fontSize: 32, color: Colors.text, lineHeight: 38 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: Typography.size.base,
    fontWeight: '700',
    color: Colors.text,
  },
  content: { padding: Spacing.base, gap: Spacing.lg, paddingBottom: tabBarScrollPadding },
  sectionLabel: {
    fontSize: Typography.size.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  durationRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  durationChip: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationChipActive: { backgroundColor: Colors.mindfulness, borderColor: Colors.mindfulness },
  durationText: { fontSize: Typography.size.base, color: Colors.text, fontWeight: '700' },
  durationTextActive: { color: Colors.white },
  techGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  techCard: {
    width: '48%',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 4,
  },
  techCardActive: { borderColor: Colors.mindfulness, backgroundColor: '#E7FBF6' },
  techName: { fontSize: Typography.size.sm, fontWeight: '700', color: Colors.text },
  techNameActive: { color: Colors.text },
  techDesc: { fontSize: Typography.size.xs, color: Colors.textSecondary, lineHeight: 16 },
  timerWrap: { alignItems: 'center', gap: Spacing.md },
  timerCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 3,
    borderColor: Colors.mindfulness,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  timerTime: { fontSize: Typography.size['3xl'], fontWeight: '800', color: Colors.text, letterSpacing: -1 },
  timerLabel: { fontSize: Typography.size.sm, color: Colors.textSecondary, textAlign: 'center', fontWeight: '600' },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: Colors.mindfulness, borderRadius: 3 },
  guidanceCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    borderLeftWidth: 3,
    borderLeftColor: Colors.mindfulness,
  },
  guidanceText: { fontSize: Typography.size.sm, color: Colors.text, lineHeight: 22 },
  completeCard: {
    backgroundColor: Colors.successLight,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  completeTitle: { fontSize: Typography.size.lg, fontWeight: '700', color: Colors.text },
  completeSub: { fontSize: Typography.size.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  controls: { gap: Spacing.sm },
  primaryBtn: { borderRadius: Radius.xl, paddingVertical: Spacing.base, alignItems: 'center' },
  primaryBtnText: { color: Colors.white, fontSize: Typography.size.lg, fontWeight: '700' },
  secondaryBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  secondaryBtnText: { color: Colors.textSecondary, fontSize: Typography.size.sm, fontWeight: '700' },
});
