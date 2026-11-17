import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors, Radius, Shadow, Spacing, TabBarMetrics, Typography } from '../../theme';
import { Screen } from '../../navigation/screenNames';
import { useAppStore } from '../../store';
import { carePlanService } from '../../services/firebase';
import { syncUnseenCarePlan } from '../../services/carePlanUnseen';
import { AnimatedPressable } from '../ui';

/**
 * True on the first screen of a tab other than Home. Home shows the plan in the page,
 * and pushed screens (details, chat) keep their own headers and inputs clear.
 */
function useAtNonHomeTabRoot(): boolean {
  return useNavigationState((rootState: any) => {
    const patientApp = rootState?.routes?.[rootState?.index ?? 0];
    const tabs = patientApp?.state;
    if (!tabs?.routes) return false; // Home is the initial tab
    const tab = tabs.routes[tabs.index ?? 0];
    if (!tab || tab.name === Screen.tabHome) return false;
    const stack = tab.state;
    return !stack || (stack.index ?? 0) === 0;
  });
}

/**
 * Watches incoming care plans (the single listener for the patient app) and shows a
 * small notice just above the tab bar until the patient opens or dismisses it.
 * The system notification comes from the server push only, so one plan = one alert.
 */
export default function CarePlanArrivalNotice() {
  const navigation = useNavigation<any>();
  const atTabRoot = useAtNonHomeTabRoot();
  const [dismissedPlanId, setDismissedPlanId] = useState<string | null>(null);
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
      if (cancelled) return;
      setCarePlan(latest);
      syncUnseenCarePlan(user.uid, latest, setHasUnseenCarePlan).catch(() => {});
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [user?.uid, user?.role, setCarePlan, setHasUnseenCarePlan]);

  if (!atTabRoot || !hasUnseenCarePlan || !carePlan || dismissedPlanId === carePlan.id) return null;

  const from = carePlan.clinicianName?.trim();
  const open = () => {
    const tab = user?.clinicianId ? Screen.tabMyCare : Screen.tabMore;
    navigation.navigate(tab, { screen: Screen.carePlan });
  };

  return (
    <View pointerEvents="box-none" style={styles.host}>
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
        <Pressable
          onPress={() => setDismissedPlanId(carePlan.id)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Hide care plan notice"
          style={styles.close}
        >
          <Ionicons name="close" size={18} color={Colors.textTertiary} />
        </Pressable>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: Spacing.base,
    right: Spacing.base,
    // Sits just above the floating tab bar — never over headers or back buttons.
    bottom: TabBarMetrics.bottom + TabBarMetrics.height + Spacing.sm,
    zIndex: 40,
  },
  close: { padding: 2 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(140, 89, 191, 0.28)',
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
