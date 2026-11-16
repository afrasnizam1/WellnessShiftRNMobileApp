import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../../theme';

const ADC_IMAGE = require('../../assets/anatomy/antibody-drug-conjugate.jpg');

export type AdcPart = 'antibody' | 'linker' | 'payload';

const PARTS: Record<AdcPart, { title: string; body: string }> = {
  antibody: {
    title: 'Antibody',
    body: 'The large blue and purple shapes are antibodies. Each one is built to recognise a protein that sits more often on the cancer cells being targeted, then lock on.',
  },
  linker: {
    title: 'Linker',
    body: 'A small chemical linker holds the drug onto the antibody. It is meant to keep the drug attached in the bloodstream, then break once the medicine is inside the cell.',
  },
  payload: {
    title: 'Payload',
    body: 'The orange spheres are the payload — a chemotherapy drug. The aim is to release it inside the cancer cell, rather than spreading that dose through the whole body.',
  },
};

/** Orange payload centres, as fractions of the picture. */
const PAYLOADS: Array<{ x: number; y: number }> = [
  { x: 0.28, y: 0.46 },
  { x: 0.38, y: 0.38 },
  { x: 0.58, y: 0.56 },
  { x: 0.68, y: 0.63 },
  { x: 0.68, y: 0.2 },
];

type Props = {
  onPartChange?: (part: AdcPart) => void;
};

export default function AdcDiagram({ onPartChange }: Props) {
  const [selected, setSelected] = useState<AdcPart | null>(null);

  const select = (part: AdcPart) => {
    setSelected(part);
    onPartChange?.(part);
  };

  const copy = selected ? PARTS[selected] : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.figure}>
        <Image
          source={ADC_IMAGE}
          style={styles.image}
          resizeMode="contain"
          accessibilityLabel="Antibody-drug conjugate. Blue and purple shapes are antibodies. Orange spheres are the drug payload."
        />
        <Pressable
          style={styles.antibodyHit}
          onPress={() => select('antibody')}
          accessibilityRole="button"
          accessibilityLabel="Antibody"
        />
        {PAYLOADS.map((dot) => (
          <Pressable
            key={`${dot.x}-${dot.y}`}
            style={[
              styles.payloadHit,
              { left: `${dot.x * 100}%`, top: `${dot.y * 100}%` },
              selected === 'payload' && styles.payloadHitActive,
            ]}
            onPress={() => select('payload')}
            accessibilityRole="button"
            accessibilityLabel="Drug payload"
          />
        ))}
      </View>

      <View style={styles.chips}>
        {(Object.keys(PARTS) as AdcPart[]).map((id) => {
          const active = selected === id;
          return (
            <Pressable
              key={id}
              onPress={() => select(id)}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <View style={[styles.dot, id === 'payload' ? styles.dotPayload : styles.dotAntibody]} />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{PARTS[id].title}</Text>
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
        <Text style={styles.regionBody}>
          Tap a blue or purple shape, an orange sphere, or one of the labels.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#F7F4F2',
    borderRadius: Radius.lg,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    overflow: 'hidden',
  },
  figure: {
    width: '100%',
    aspectRatio: 1024 / 576,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  antibodyHit: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  payloadHit: {
    position: 'absolute',
    width: 44,
    height: 44,
    marginLeft: -22,
    marginTop: -22,
    borderRadius: 22,
  },
  payloadHitActive: {
    borderWidth: 2,
    borderColor: '#E07A2F',
    backgroundColor: 'rgba(224, 122, 47, 0.15)',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  dotPayload: { backgroundColor: '#F08A3A' },
  dotAntibody: { backgroundColor: '#8E7CC3' },
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
