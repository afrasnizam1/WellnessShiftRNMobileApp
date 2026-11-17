/**
 * The website's 3D wellness sphere (three.js) in a WebView.
 * Source: src/hologram/wellnessSphere.ts → `npm run bundle:sphere`.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { WELLNESS_SPHERE_HTML } from './wellnessSphereHtml';

type Props = {
  /** Category fills, 0–1, in home wellness-category order. */
  pcts: number[];
  colors: string[];
  selected: number;
  paused: boolean;
  /** False when Home is off screen — the render loop stops. */
  active: boolean;
  onPick?: (index: number) => void;
  /** Centre glow colour (overall score band). */
  coreColor?: string;
};

function WellnessSphereView({ pcts, colors, selected, paused, active, onPick, coreColor }: Props) {
  const ref = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // Initial state goes in before the page script runs, so the first frame is already right.
  // Later changes are pushed through wsSphere.update(); the HTML itself never changes.
  const initRef = useRef({ pcts, colors, sel: selected, paused, active, core: coreColor });
  const injectedBefore = useMemo(
    () => `window.__WS_SPHERE_INIT__=${JSON.stringify(initRef.current)};true;`,
    [],
  );
  const source = useMemo(() => ({ html: WELLNESS_SPHERE_HTML }), []);

  useEffect(() => {
    if (!ready) return;
    const patch = JSON.stringify({ pcts, colors, sel: selected, paused, active, core: coreColor });
    ref.current?.injectJavaScript(`window.wsSphere&&window.wsSphere.update(${patch});true;`);
  }, [ready, pcts, colors, selected, paused, active, coreColor]);

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(e.nativeEvent.data);
        if (msg.type === 'ready') setReady(true);
        else if (msg.type === 'pick' && typeof msg.index === 'number') onPick?.(msg.index);
        else if (msg.type === 'error') setFailed(true);
      } catch {
        /* ignore */
      }
    },
    [onPick],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <WebView
        ref={ref}
        source={source}
        originWhitelist={['*']}
        injectedJavaScriptBeforeContentLoaded={injectedBefore}
        onMessage={onMessage}
        javaScriptEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        setSupportMultipleWindows={false}
        allowsLinkPreview={false}
        allowsBackForwardNavigationGestures={false}
        // Nothing in the page should navigate; block anything that tries.
        onShouldStartLoadWithRequest={(req) => req.url.startsWith('about:') || req.url.startsWith('data:')}
        androidLayerType={Platform.OS === 'android' ? 'hardware' : undefined}
        onRenderProcessGone={() => setFailed(true)}
        onContentProcessDidTerminate={() => ref.current?.reload()}
        style={styles.web}
        containerStyle={styles.web}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      />
      {failed ? (
        <View style={styles.fallback} pointerEvents="none">
          <Text style={styles.fallbackText}>3D view isn't available on this device.</Text>
        </View>
      ) : null}
    </View>
  );
}

export default memo(WellnessSphereView);

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: 'transparent' },
  fallback: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: '#A3ACB9', fontSize: 13 },
});
