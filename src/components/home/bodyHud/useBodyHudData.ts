/**
 * "vs last week" for the Wellness Index — keeps a small per-day history of the
 * overall score on this device and compares today with the same day last week.
 */
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, subDays } from 'date-fns';

const historyKey = (uid: string) => `ws_body_hud_scores_v1_${uid}`;
const dayKey = (d: Date) => format(d, 'yyyy-MM-dd');

/**
 * Saves today's score and returns the change against 7 days ago (6–8 days if that day is
 * missing). Null when there's no comparable day yet.
 */
export function useWeekOverWeek(uid: string | null | undefined, score: number, enabled: boolean): number | null {
  const [delta, setDelta] = useState<number | null>(null);

  useEffect(() => {
    if (!uid || !enabled) {
      setDelta(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(historyKey(uid));
        const hist: Record<string, number> = raw ? JSON.parse(raw) : {};
        const now = new Date();
        hist[dayKey(now)] = score;
        const cutoff = dayKey(subDays(now, 21));
        Object.keys(hist).forEach((k) => {
          if (k < cutoff) delete hist[k];
        });
        await AsyncStorage.setItem(historyKey(uid), JSON.stringify(hist));
        const prev = [7, 6, 8].map((n) => hist[dayKey(subDays(now, n))]).find((v) => typeof v === 'number');
        if (!cancelled) setDelta(typeof prev === 'number' ? score - prev : null);
      } catch {
        if (!cancelled) setDelta(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, score, enabled]);

  return delta;
}
