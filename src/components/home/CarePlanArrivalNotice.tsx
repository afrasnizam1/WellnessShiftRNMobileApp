import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors, Radius, Shadow, Spacing, Typography } from '../../theme';
import { Screen } from '../../navigation/screenNames';
import { useAppStore } from '../../store';
import { carePlanService } from '../../services/firebase';
import { syncUnseenCarePlan } from '../../services/carePlanUnseen';
import { announceNewCarePlan } from '../../services/carePlanAlerts';
import { AnimatedPressable } from '../ui';

/** Watches incoming care plans and pins a notice under the status bar until the patient opens it. */
export default function CarePlanArrivalNotice() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const user = useAppStore((s) => s.user);
  const carePlan = useAppStore((s) => s.carePlan);
  const hasUnseenCarePlan = useAppStore((s) => s.hasUnseenCarePlan);
  const setCarePlan = useAppStore((s) => s.setCarePlan);
  const setHasUnseenCarePlan = useAppStore((s) => s.setHasUnseenCarePlan);

  useEffect(() => {
    if (!user?.uid || user.role === 'clinician') return;
    let cancelled = false;
    const unsub = carePlanService.watchCarePlans(user.uid, (plans) => {
      const latest = plans[0] ?? null;
      setCarePlan(latest);
      syncUnseenCarePlan(user.uid, latest, setHasUnseenCarePlan)
        .then((unseen) => {
          if (cancelled || !unseen || !latest) return;
          return announceNewCarePlan(user.uid, latest);
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [user?.uid, user?.role, setCarePlan, setHasUnseenCarePlan]);

  if (!hasUnseenCarePlan || !carePlan) return null;

  const from = carePlan.clinicianName?.trim();
  const open = () => {
    const tab = user?.clinicianId ? Screen.tabMyCare : Screen.tabMore;
    navigation.navigate(tab, { screen: Screen.carePlan });
  };

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 6 }]}>
      <AnimatedPressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel="New care plan from your clinician"
        style={styles.banner}
      >
        <View style={styles.icon}>
          <Ionicons name="clipboard" size={18} color={Colors.white} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>New care plan</Text>
          <Text style={styles.body} numberOfLines={1}>
            {from ? `${from} sent ${carePlan.title}` : carePlan.title}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: Spacing.base,
    right: Spacing.base,
    zIndex: 40,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.28)',
    ...Shadow.md,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.purple,
  },
  text: { flex: 1, minWidth: 0 },
  title: {
    fontSize: Typography.size.sm,
    fontWeight: '800',
    color: Colors.text,
  },
  body: {
    fontSize: Typography.size.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
});
