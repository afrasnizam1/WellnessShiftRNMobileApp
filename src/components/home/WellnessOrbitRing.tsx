// src/components/home/WellnessOrbitRing.tsx
import React, { useCallback, useEffect, useMemo, memo } from 'react';
import { View, Text, StyleSheet, Pressable, PixelRatio } from 'react-native';
import Svg, { Circle, Path, G, Line } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { WELLNESS_CATEGORIES, Colors, Typography, Animation } from '../../theme';
import type { WellnessCategoryKey, WellnessCategoryScores } from '../../types';
import type { ScoreChangeFeedback } from '../../hooks/useWellnessScoreChangeFeedback';
import {
  buildModernDnaRing,
  computeHelixCanvasInset,
  computeOrbitPanelSide,
  computeRingLayout,
} from './wellnessHelixPaths';
import type { ChartTapContext } from '../analytics/chartTapAnalytics';
import { chartTapAccessibilityLabel, trackChartCategoryTap } from '../analytics/chartTapAnalytics';

interface Props {
  score: number;
  categories?: WellnessCategoryScores;
  size?: number;
  spin?: boolean;
  selectedCategory?: WellnessCategoryKey | null;
  onCategorySelect?: (category: WellnessCategoryKey, categoryScore: number) => void;
  onCenterPress?: () => void;
  /** CSQ tap labels for category ring presses */
  analytics?: ChartTapContext;
  /** Brief celebration / dip feedback when a score changes */
  scoreFeedback?: ScoreChangeFeedback | null;
}

const SCORE_GREEN = '#33C7A3';
/** Calm orbit — slower spin looks modern and costs less GPU churn. */
const DNA_SPIN_MS = 32000;

function shortCategoryLabel(label: string): string {
  return label
    .replace(' Health', '')
    .replace(' Wellness', '')
    .replace(' Management', '')
    .replace('–Life Balance', '');
}

function roundPx(value: number): number {
  return PixelRatio.roundToNearestPixel(value);
}

export function getOrbitPanelSize(size: number): number {
  return roundPx(computeOrbitPanelSide(size));
}

export default memo(function WellnessOrbitRing({
  score,
  categories,
  size = 160,
  spin = true,
  selectedCategory = null,
  onCategorySelect,
  onCenterPress,
  analytics,
  scoreFeedback = null,
}: Props) {
  const layout = useMemo(() => computeRingLayout(size), [size]);
  const canvasInset = useMemo(() => computeHelixCanvasInset(size, layout), [size, layout]);
  const panelSide = useMemo(() => roundPx(size + canvasInset * 2), [size, canvasInset]);
  const cx = panelSide / 2;
  const cy = panelSide / 2;
  const dna = useMemo(
    () => buildModernDnaRing(panelSide, layout.dnaOrbitRadius),
    [panelSide, layout.dnaOrbitRadius],
  );
  const viewBox = `0 0 ${panelSide} ${panelSide}`;

  const rotation = useSharedValue(0);
  const centerScale = useSharedValue(1);
  const centerShake = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const badgeOpacity = useSharedValue(0);
  const badgeTranslateY = useSharedValue(8);
  const sparkleOpacity = useSharedValue(0);

  useEffect(() => {
    if (!spin) {
      cancelAnimation(rotation);
      return;
    }
    rotation.value = 0;
    rotation.value = withRepeat(
      withTiming(360, { duration: DNA_SPIN_MS, easing: Easing.linear }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(rotation);
    };
  }, [spin, rotation]);

  useEffect(() => {
    if (!scoreFeedback) return;

    if (scoreFeedback.direction === 'up') {
      centerScale.value = withSequence(
        withSpring(1.14, Animation.spring),
        withSpring(1, Animation.spring),
      );
      glowOpacity.value = withSequence(
        withTiming(1, { duration: 140 }),
        withTiming(0, { duration: 1000 }),
      );
      sparkleOpacity.value = withSequence(
        withTiming(1, { duration: 120 }),
        withTiming(0, { duration: 1100 }),
      );
      badgeOpacity.value = withSequence(
        withTiming(1, { duration: 100 }),
        withTiming(1, { duration: 900 }),
        withTiming(0, { duration: 300 }),
      );
      badgeTranslateY.value = withSequence(
        withTiming(-6, { duration: 700 }),
        withTiming(-14, { duration: 600 }),
      );
      return;
    }

    centerScale.value = withSequence(
      withTiming(0.94, { duration: 120 }),
      withSpring(1, Animation.spring),
    );
    centerShake.value = withSequence(
      withTiming(-4, { duration: 60 }),
      withTiming(4, { duration: 60 }),
      withTiming(-2, { duration: 60 }),
      withTiming(0, { duration: 60 }),
    );
    glowOpacity.value = withSequence(
      withTiming(0.7, { duration: 140 }),
      withTiming(0, { duration: 800 }),
    );
    badgeOpacity.value = withSequence(
      withTiming(1, { duration: 100 }),
      withTiming(1, { duration: 700 }),
      withTiming(0, { duration: 300 }),
    );
    badgeTranslateY.value = 4;
  }, [scoreFeedback, badgeOpacity, badgeTranslateY, centerScale, centerShake, glowOpacity, sparkleOpacity]);

  const helixStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const centerWrapStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: centerScale.value },
      { translateX: centerShake.value },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: badgeOpacity.value,
    transform: [{ translateY: badgeTranslateY.value }],
  }));

  const sparkleStyle = useAnimatedStyle(() => ({
    opacity: sparkleOpacity.value,
  }));

  const feedbackAppliesToCenter =
    scoreFeedback &&
    (scoreFeedback.category === 'overall' ||
      scoreFeedback.category === selectedCategory ||
      selectedCategory == null);

  const deltaLabel = scoreFeedback
    ? `${scoreFeedback.delta > 0 ? '+' : ''}${scoreFeedback.delta.toFixed(1)}`
    : '';

  const sortedCategories = useMemo(() => {
    return [...WELLNESS_CATEGORIES].sort((a, b) => {
      const scoreA = categories?.[a.key as WellnessCategoryKey] ?? 0;
      const scoreB = categories?.[b.key as WellnessCategoryKey] ?? 0;
      return scoreB - scoreA;
    });
  }, [categories]);

  const selectedMeta = selectedCategory
    ? WELLNESS_CATEGORIES.find((c) => c.key === selectedCategory)
    : null;
  const selectedScore = selectedCategory
    ? categories?.[selectedCategory] ?? 0
    : score;

  const handleCategoryPress = useCallback((key: WellnessCategoryKey, categoryScore: number) => {
    if (analytics) {
      trackChartCategoryTap(analytics, key);
    }
    onCategorySelect?.(key, categoryScore);
  }, [analytics, onCategorySelect]);

  const handleCenterPress = () => {
    if (selectedCategory) {
      onCenterPress?.();
    }
  };

  // Stay inside the innermost ring, including the thicker stroke used when a segment is selected.
  const innerEdge = layout.minDiameter / 2 - layout.lineWidth / 2 - 3;
  const disc = Math.max(28, Math.min(layout.centerDisc, innerEdge * 2));
  const scoreFontSize = selectedCategory ? disc * 0.26 : disc * 0.32;
  const labelFontSize = Math.max(7, disc * (selectedCategory ? 0.13 : 0.15));
  const subLabelFontSize = Math.max(6, disc * 0.1);
  const centerTextWidth = disc * 0.78;

  return (
    <View
      style={{
        width: panelSide,
        height: panelSide,
        minWidth: panelSide,
        minHeight: panelSide,
        aspectRatio: 1,
        flexShrink: 0,
        alignSelf: 'flex-start',
      }}
    >
      <Animated.View
        collapsable={false}
        shouldRasterizeIOS
        renderToHardwareTextureAndroid
        style={[
          styles.helixLayer,
          { width: panelSide, height: panelSide },
          helixStyle,
        ]}
        pointerEvents="none"
      >
        <Svg width={panelSide} height={panelSide} viewBox={viewBox}>
          {/* Soft orbital track — grounds the DNA without extra animation cost */}
          <Circle
            cx={cx}
            cy={cy}
            r={dna.trackRadius}
            stroke="rgba(107, 92, 231, 0.10)"
            strokeWidth={dna.trackWidth + 6}
            fill="none"
          />
          <Circle
            cx={cx}
            cy={cy}
            r={dna.trackRadius}
            stroke="rgba(43, 196, 182, 0.12)"
            strokeWidth={dna.trackWidth}
            fill="none"
          />

          {/* Back / softer pass of both strands */}
          <Path
            d={dna.strandA}
            stroke={dna.strandAColor}
            strokeWidth={dna.strandWidth * 0.72}
            strokeOpacity={0.28}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d={dna.strandB}
            stroke={dna.strandBColor}
            strokeWidth={dna.strandWidth * 0.72}
            strokeOpacity={0.28}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {dna.rungs.map((rung, index) => (
            <Line
              key={`rung-${index}`}
              x1={rung.x1}
              y1={rung.y1}
              x2={rung.x2}
              y2={rung.y2}
              stroke={rung.color}
              strokeWidth={Math.max(1.2, dna.strandWidth * 0.45)}
              strokeOpacity={rung.opacity}
              strokeLinecap="round"
            />
          ))}

          {/* Front strands — crisp dual-tone DNA */}
          <Path
            d={dna.strandA}
            stroke={dna.strandAColor}
            strokeWidth={dna.strandWidth}
            strokeOpacity={0.92}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d={dna.strandB}
            stroke={dna.strandBColor}
            strokeWidth={dna.strandWidth}
            strokeOpacity={0.92}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {dna.nodes.map((node, index) => (
            <Circle
              key={`node-${index}`}
              cx={node.x}
              cy={node.y}
              r={node.radius}
              fill="#FFFFFF"
              stroke={node.color}
              strokeWidth={1.1}
              opacity={node.opacity}
            />
          ))}
        </Svg>
      </Animated.View>

      <Svg
        width={panelSide}
        height={panelSide}
        viewBox={viewBox}
        style={styles.ringsLayer}
      >
        {sortedCategories.map((cat, index) => {
          const ringDiameter = layout.maxDiameter - index * layout.sizeStep;
          const radius = ringDiameter / 2;
          const catScore = categories?.[cat.key as WellnessCategoryKey] ?? 0;
          const isSelected = selectedCategory === cat.key;
          const isDimmed = selectedCategory != null && !isSelected;
          const isOutermost = index === 0;
          const strokeExtra = isSelected ? (isOutermost ? 1.5 : 2.5) : 0;
          // Extra thickness grows outward so a selected ring never covers the center label.
          const drawRadius = radius + strokeExtra / 2;
          const strokeWidth = layout.lineWidth + strokeExtra;
          const circumference = 2 * Math.PI * drawRadius;
          const progress = Math.min(catScore / 10, 1) * circumference;
          const gap = circumference - progress;
          const isFeedbackRing =
            scoreFeedback != null &&
            (scoreFeedback.category === cat.key ||
              (scoreFeedback.category === 'overall' && isSelected));
          const ringBoost = isFeedbackRing && scoreFeedback?.direction === 'up' ? 0.08 : 0;
          const ringDim = isFeedbackRing && scoreFeedback?.direction === 'down' ? 0.12 : 0;
          const ringScale = 1 + ringBoost;

          return (
            <G
              key={cat.key}
              rotation={-90}
              origin={`${cx}, ${cy}`}
              scale={ringScale}
            >
              <Circle
                cx={cx}
                cy={cy}
                r={radius}
                stroke={cat.color}
                strokeWidth={layout.lineWidth}
                strokeOpacity={0.14}
                fill="none"
              />
              <Circle
                cx={cx}
                cy={cy}
                r={drawRadius}
                stroke={cat.color}
                strokeWidth={strokeWidth}
                strokeOpacity={isDimmed ? 0.65 : Math.max(0.45, 0.92 - ringDim)}
                fill="none"
                strokeDasharray={`${progress} ${gap}`}
                strokeLinecap="round"
              />
              {onCategorySelect && (
                <Circle
                  cx={cx}
                  cy={cy}
                  r={radius}
                  stroke="transparent"
                  strokeWidth={Math.max(layout.lineWidth + 14, 18)}
                  fill="none"
                  onPress={() => handleCategoryPress(cat.key as WellnessCategoryKey, catScore)}
                  accessible
                  accessibilityLabel={chartTapAccessibilityLabel(
                    analytics?.chart ?? 'Wellness Ring',
                    shortCategoryLabel(cat.label),
                  )}
                />
              )}
            </G>
          );
        })}
      </Svg>

      <Pressable
        style={[styles.centre, { width: panelSide, height: panelSide }]}
        onPress={handleCenterPress}
        disabled={!selectedCategory}
        accessibilityLabel={
          selectedCategory && selectedMeta
            ? chartTapAccessibilityLabel(analytics?.chart ?? 'Wellness Ring', 'Clear selection')
            : chartTapAccessibilityLabel(analytics?.chart ?? 'Wellness Ring', 'Overall score')
        }
        accessibilityRole="button"
      >
        <Animated.View
          style={[
            styles.centerGlow,
            {
              width: disc * 1.08,
              height: disc * 1.08,
              borderRadius: disc * 0.54,
              backgroundColor:
                scoreFeedback?.direction === 'down'
                  ? 'rgba(120, 130, 150, 0.22)'
                  : 'rgba(51, 199, 163, 0.28)',
            },
            glowStyle,
          ]}
          pointerEvents="none"
        />
        <Animated.View style={[styles.centerContent, centerWrapStyle]}>
          <View
            style={[
              styles.centerClip,
              {
                width: disc,
                height: disc,
                borderRadius: disc / 2,
              },
            ]}
          >
            <View style={styles.centerDisc} />
            <View style={[styles.centerText, { maxWidth: centerTextWidth }]}>
              {selectedCategory && selectedMeta ? (
                <>
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    style={[
                      styles.scoreNumber,
                      {
                        fontSize: scoreFontSize,
                        lineHeight: scoreFontSize * 1.02,
                        color: selectedMeta.color,
                      },
                      feedbackAppliesToCenter &&
                        scoreFeedback?.direction === 'up' && styles.scoreNumberUp,
                      feedbackAppliesToCenter &&
                        scoreFeedback?.direction === 'down' && styles.scoreNumberDown,
                    ]}
                  >
                    {selectedScore.toFixed(1)}
                  </Text>
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.65}
                    style={[
                      styles.categoryName,
                      { fontSize: labelFontSize, lineHeight: labelFontSize * 1.1, color: selectedMeta.color },
                    ]}
                  >
                    {shortCategoryLabel(selectedMeta.label)}
                  </Text>
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={[styles.scoreSubLabel, { fontSize: subLabelFontSize, lineHeight: subLabelFontSize * 1.1 }]}
                  >
                    out of 10
                  </Text>
                </>
              ) : (
                <>
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    style={[
                      styles.scoreNumber,
                      { fontSize: scoreFontSize, lineHeight: scoreFontSize * 1.02 },
                      feedbackAppliesToCenter &&
                        scoreFeedback?.direction === 'up' && styles.scoreNumberUp,
                      feedbackAppliesToCenter &&
                        scoreFeedback?.direction === 'down' && styles.scoreNumberDown,
                    ]}
                  >
                    {score.toFixed(1)}
                  </Text>
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={[styles.scoreLabel, { fontSize: labelFontSize, lineHeight: labelFontSize * 1.1 }]}
                  >
                    Wellness
                  </Text>
                </>
              )}
            </View>
          </View>
        </Animated.View>

        {scoreFeedback && feedbackAppliesToCenter && (
          <Animated.View style={[styles.deltaBadge, badgeStyle]} pointerEvents="none">
            <Text
              style={[
                styles.deltaBadgeText,
                scoreFeedback.direction === 'up' ? styles.deltaUp : styles.deltaDown,
              ]}
            >
              {deltaLabel}
            </Text>
          </Animated.View>
        )}

        {scoreFeedback?.direction === 'up' && feedbackAppliesToCenter && (
          <Animated.View style={[styles.sparkleWrap, sparkleStyle]} pointerEvents="none">
            <Text style={[styles.sparkle, styles.sparkleTopLeft]}>✦</Text>
            <Text style={[styles.sparkle, styles.sparkleTopRight]}>✦</Text>
            <Text style={[styles.sparkle, styles.sparkleBottom]}>✦</Text>
          </Animated.View>
        )}
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  helixLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  ringsLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  centre: {
    position: 'absolute',
    left: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerGlow: {
    position: 'absolute',
  },
  centerClip: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  centerDisc: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  centerText: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  scoreNumber: {
    fontWeight: '700',
    color: SCORE_GREEN,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  scoreNumberUp: {
    color: '#2DB88E',
  },
  scoreNumberDown: {
    color: Colors.textSecondary,
  },
  scoreLabel: {
    color: Colors.textSecondary,
    fontWeight: '500',
    marginTop: 1,
    textAlign: 'center',
  },
  categoryName: {
    fontWeight: '700',
    marginTop: 1,
    textAlign: 'center',
  },
  scoreSubLabel: {
    color: Colors.textTertiary,
    marginTop: 1,
    textAlign: 'center',
  },
  deltaBadge: {
    position: 'absolute',
    top: '22%',
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  deltaBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  deltaUp: {
    color: '#2DB88E',
  },
  deltaDown: {
    color: Colors.textSecondary,
  },
  sparkleWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkle: {
    position: 'absolute',
    color: '#5EDBB5',
    fontSize: 14,
    fontWeight: '700',
  },
  sparkleTopLeft: {
    top: '18%',
    left: '24%',
  },
  sparkleTopRight: {
    top: '20%',
    right: '22%',
  },
  sparkleBottom: {
    bottom: '28%',
  },
});
