import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { CSQWebView } from '@contentsquare/react-native-bridge';
import AppScreen from '../../components/common/AppScreen';
import { ScreenHeader } from '../../components/ui';
import { Spacing } from '../../theme';
import { useAppStore } from '../../store';
import { healthKitService } from '../../services/healthkit';
import { HEALTH_HOLOGRAM_3D_HTML } from '../../hologram/healthHologram3dHtml';
import { logger } from '../../utils/logger';

const BG = '#050811';

/** Default daily goals until per-user goals are stored. */
const GOALS = { steps: 10000, sleepHours: 8, exerciseMinutes: 30 } as const;

type RingPayload = { id: string; name: string; value: number; goal: number; label: string };

/** Category scores are 0–10 (older data may be 0–100). Returns 0–100. */
function toPercentScore(raw: number | undefined): number | undefined {
  if (raw == null || Number.isNaN(raw)) return undefined;
  return raw <= 10 ? raw * 10 : raw;
}

function formatSleep(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m === 60 ? `${h + 1}h 00m` : `${h}h ${String(m).padStart(2, '0')}m`;
}

export default function HealthHologram3DScreen() {
  const navigation = useNavigation<any>();
  const activity = useAppStore((s) => s.activity);
  const setActivity = useAppStore((s) => s.setActivity);
  const wellnessScore = useAppStore((s) => s.wellnessScore);
  const [loading, setLoading] = useState(true);

  // Refresh today's Apple Health / Health Connect numbers when available.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (await healthKitService.isConnected()) {
          const today = await healthKitService.getTodayActivity();
          if (!cancelled && today) setActivity(today);
        }
      } catch (e) {
        logger.warn('HealthHologram3D: could not refresh activity', e);
      }
    })();
    return () => { cancelled = true; };
  }, [setActivity]);

  const payload = useMemo(() => {
    const cats = wellnessScore?.categories;
    const score = (key: keyof NonNullable<typeof cats>, name: string, id: string): RingPayload => {
      const v = toPercentScore(cats?.[key]);
      return { id, name, value: v ?? 0, goal: 100, label: v == null ? 'No data yet' : `${Math.round(v)} / 100` };
    };
    const sleepHours = activity?.sleepHours;
    const sleepFromScore = toPercentScore(cats?.sleep);
    const rings: RingPayload[] = [
      sleepHours != null && sleepHours > 0
        ? { id: 'sleep', name: 'Sleep', value: sleepHours, goal: GOALS.sleepHours, label: formatSleep(sleepHours) }
        : { id: 'sleep', name: 'Sleep', value: sleepFromScore ?? 0, goal: 100, label: sleepFromScore == null ? 'No data yet' : `${Math.round(sleepFromScore)} / 100` },
      { id: 'activity', name: 'Activity', value: activity?.steps ?? 0, goal: GOALS.steps,
        label: activity ? `${(activity.steps ?? 0).toLocaleString('en-GB')} steps` : 'No data yet' },
      { id: 'heart', name: 'Heart', value: activity?.exerciseMinutes ?? 0, goal: GOALS.exerciseMinutes,
        label: activity ? `${Math.round(activity.exerciseMinutes ?? 0)} active min` : 'No data yet' },
      score('mindfulness', 'Mindfulness', 'mind'),
      score('stress', 'Stress balance', 'hydration'),
      score('nutrition', 'Nutrition', 'nutrition'),
    ];
    return {
      metrics: rings,
      restingHeartRate: activity?.restingHeartRate ?? null,
      organs: [
        { id: 'heart', about: 'A four-chambered muscular pump. Regular active minutes strengthen it and help your resting heart rate come down over time.' },
        { id: 'kidneys', about: 'The kidneys filter your blood, and the adrenal glands on top of them make stress hormones. Calmer days take load off this system.' },
      ],
    };
  }, [activity, wellnessScore]);

  const dataKey = useMemo(() => JSON.stringify(payload), [payload]);
  const injected = `window.WS_APP_DATA = ${dataKey}; true;`;

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg?.type === 'organ') logger.log('HealthHologram3D organ viewed', msg.organ);
    } catch {
      // ignore non-JSON messages
    }
  };

  return (
    <AppScreen mesh={false} backgroundColor={BG} statusBarStyle="light-content" edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <ScreenHeader title="Your health in 3D" subtitle="Your daily rings and organ holograms" onBack={() => navigation.goBack()} />
      </View>
      <View style={styles.body}>
        <CSQWebView style={styles.flex}>
          <WebView
            key={dataKey}
            source={{ html: HEALTH_HOLOGRAM_3D_HTML, baseUrl: 'about:blank' }}
            injectedJavaScriptBeforeContentLoaded={injected}
            onMessage={onMessage}
            onLoadEnd={() => setLoading(false)}
            style={styles.webview}
            originWhitelist={['about:*']}
            javaScriptEnabled
            domStorageEnabled={false}
            allowsInlineMediaPlayback
            androidHardwareAccelerationDisabled={false}
            overScrollMode="never"
            bounces={false}
            setSupportMultipleWindows={false}
          />
        </CSQWebView>
        {loading && (
          <View style={styles.loader} pointerEvents="none">
            <ActivityIndicator color="#EC4F96" />
          </View>
        )}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Spacing.lg, backgroundColor: BG },
  body: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },
  webview: { flex: 1, backgroundColor: BG },
  loader: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: BG },
});
