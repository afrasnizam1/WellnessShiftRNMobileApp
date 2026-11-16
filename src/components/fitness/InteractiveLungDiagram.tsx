import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, PixelRatio } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../../theme';

const BRONCHIAL_TREE = require('../../assets/anatomy/bronchial-alveoli-hd.png');

export type LungRegion = 'airways' | 'alveoli';

type RegionCopy = {
  id: LungRegion;
  title: string;
  body: string;
};

const REGIONS: Record<LungRegion, RegionCopy> = {
  airways: {
    id: 'airways',
    title: 'Airways',
    body: 'The coloured trunk is the windpipe. It splits into bronchi, then into smaller and smaller tubes. Air travels down that tree into both lungs.',
  },
  alveoli: {
    id: 'alveoli',
    title: 'Alveoli',
    body: 'The orange clusters are alveoli — tiny air sacs at the ends of the smallest airways. This is where oxygen passes into the blood. Adults have hundreds of millions of them.',
  },
};

type Props = {
  onRegionChange?: (region: LungRegion) => void;
};

export default function InteractiveLungDiagram({ onRegionChange }: Props) {
  const [selected, setSelected] = useState<LungRegion | null>(null);

  const select = (region: LungRegion) => {
    setSelected(region);
    onRegionChange?.(region);
  };

  const copy = selected ? REGIONS[selected] : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.figure}>
        <Image
          source={BRONCHIAL_TREE}
          style={styles.image}
          resizeMode="contain"
          accessibilityLabel="Bronchial tree. The central tubes are the airways. The orange clusters are alveoli."
        />
        <Pressable
          style={styles.alveoliHit}
          onPress={() => select('alveoli')}
          accessibilityRole="button"
          accessibilityLabel="Alveoli"
        />
        <Pressable
          style={[styles.airwayHit, selected === 'airways' && styles.hitActive]}
          onPress={() => select('airways')}
          accessibilityRole="button"
          accessibilityLabel="Airways"
        />
        {selected === 'alveoli' ? <View pointerEvents="none" style={styles.alveoliHighlight} /> : null}
      </View>

      <View style={styles.chips}>
        {(Object.keys(REGIONS) as LungRegion[]).map((id) => {
          const active = selected === id;
          return (
            <Pressable
              key={id}
              onPress={() => select(id)}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <View style={[styles.dot, id === 'alveoli' ? styles.dotAlveoli : styles.dotAirway]} />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{REGIONS[id].title}</Text>
            </Pressable>
          );
        })}
      </View>

      {copy ? (
        <>
          <Text style={styles.regionTitle}>{copy.title}</Text>
          <Text style={styles.regionBody}>{copy.body}</Text>
        </>
      ) : (
        <Text style={styles.regionBody}>Tap the coloured trunk or the orange air sacs.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#F4F4F4',
    borderRadius: Radius.lg,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    overflow: 'hidden',
  },
  figure: {
    width: '100%',
    maxWidth: 864 / PixelRatio.get(),
    alignSelf: 'center',
    aspectRatio: 3 / 4,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  airwayHit: {
    position: 'absolute',
    top: 0,
    left: '28%',
    width: '50%',
    height: '34%',
  },
  alveoliHit: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  hitActive: {
    backgroundColor: 'rgba(142, 124, 195, 0.12)',
  },
  alveoliHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '36%',
    bottom: 0,
    backgroundColor: 'rgba(240, 138, 58, 0.1)',
  },
  chips: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    borderColor: '#E85A4F',
    backgroundColor: '#FFF1EE',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotAlveoli: { backgroundColor: '#F08A3A' },
  dotAirway: { backgroundColor: '#8E7CC3' },
  chipText: { fontSize: Typography.size.xs, color: Colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#C2412D' },
  regionTitle: {
    marginTop: Spacing.sm,
    fontSize: Typography.size.sm,
    fontWeight: '800',
    color: Colors.text,
  },
  regionBody: {
    marginTop: 4,
    fontSize: Typography.size.sm,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
});
