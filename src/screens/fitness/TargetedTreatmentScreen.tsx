import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors, Typography, Spacing, Radius, tabBarScrollPadding } from '../../theme';
import { AppCard, ScreenHeader } from '../../components/ui';
import AppScreen from '../../components/common/AppScreen';
import AdcDiagram from '../../components/fitness/AdcDiagram';

const SOURCE_URL = 'https://www.gsk.com/en-gb/behind-the-science-magazine/antibody-drug-conjugates-adcs/';

const SECTIONS: Array<{ title: string; body?: string; points?: string[] }> = [
  {
    title: 'What an antibody-drug conjugate is',
    body: 'An antibody-drug conjugate, often shortened to ADC, is a cancer medicine made of three pieces joined together: an antibody, a linker, and a chemotherapy drug called the payload. The antibody is chosen because it recognises a protein found more often on certain cancer cells. The hope is to carry the drug into those cells instead of exposing the whole body to the same dose.',
  },
  {
    title: 'Why this approach exists',
    body: 'Radiotherapy and chemotherapy can kill cancer cells, and they remain core treatments. They also affect healthy tissue, which is why people can get side effects such as nausea, hair loss, or irritation of organs. ADCs are one of several newer ideas, alongside targeted tablets and immunotherapy, that try to be more precise. Precision does not mean the treatment is free of side effects.',
  },
  {
    title: 'What happens in the body',
    points: [
      'After it is given, the medicine circulates and looks for cells that display the target protein, called an antigen.',
      'The antibody binds that protein. The cell then takes the medicine inside.',
      'Inside the cell, the linker is broken and the payload is released.',
      'The drug is meant to disrupt that cell. Researchers also study how long a response lasts, and what to use if a cancer later stops responding.',
    ],
  },
  {
    title: 'What they are not',
    body: 'ADCs are used for some cancers, not every cancer. Tumours differ from person to person, so a medicine that fits one tumour may not fit another. GSK reports that more than 17 ADCs have been approved worldwide, with many more still in trials. Side effects still occur and depend on the medicine. They can include effects on the eyes, gut, lungs, or blood counts. Only an oncology team can say whether one of these treatments is relevant for a particular person.',
  },
];

export default function TargetedTreatmentScreen() {
  const navigation = useNavigation<any>();

  return (
    <AppScreen style={styles.safe}>
      <ScreenHeader
        title="Targeted treatment"
        subtitle="How antibody-drug conjugates work"
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AdcDiagram />

        <AppCard style={styles.callout}>
          <Text style={styles.calloutLead}>
            <Text style={styles.calloutAccent}>Antibody-drug conjugates </Text>
            are designed to carry a chemotherapy drug to selected cancer cells.
          </Text>
          <Text style={styles.calloutBody}>
            In the picture, the blue and purple shapes are antibodies. The orange spheres are the drug. A linker between them is meant to hold the drug until the medicine is inside a cell.
          </Text>
        </AppCard>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.fact}>
            <Text style={styles.factTitle}>{section.title}</Text>
            {section.body ? <Text style={styles.factBody}>{section.body}</Text> : null}
            {section.points
              ? section.points.map((point) => (
                  <View key={point} style={styles.pointRow}>
                    <View style={styles.bullet} />
                    <Text style={styles.factBody}>{point}</Text>
                  </View>
                ))
              : null}
          </View>
        ))}

        <View style={styles.fact}>
          <Text style={styles.factTitle}>Where this comes from</Text>
          <Text style={styles.factBody}>
            This page is a short teaching summary. The picture and the topic follow GSK’s public explainer on antibody-drug conjugates, published 10 April 2026.
          </Text>
          <Text style={styles.more} onPress={() => Linking.openURL(SOURCE_URL)} accessibilityRole="link">
            Read the GSK article
          </Text>
        </View>

        <Text style={styles.disclaimer}>
          Education only — not a diagnosis, a treatment plan, or a reason to start or stop a cancer medicine. Decisions about treatment belong with your clinical team. In an emergency call 999. For urgent but non-life-threatening concerns in the UK, use NHS 111 or speak to your GP.
        </Text>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: {
    padding: Spacing.base,
    gap: Spacing.md,
    paddingBottom: tabBarScrollPadding,
  },
  callout: { gap: Spacing.sm },
  calloutLead: {
    fontSize: Typography.size.lg,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 28,
  },
  calloutAccent: { color: '#E85A4F' },
  calloutBody: {
    fontSize: Typography.size.sm,
    lineHeight: 21,
    color: Colors.textSecondary,
  },
  fact: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  factTitle: { fontSize: Typography.size.base, fontWeight: '700', color: Colors.text },
  factBody: { flex: 1, fontSize: Typography.size.sm, lineHeight: 21, color: Colors.textSecondary },
  pointRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  bullet: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#E85A4F',
    marginTop: 7,
  },
  more: {
    fontSize: Typography.size.sm,
    fontWeight: '700',
    color: '#E85A4F',
  },
  disclaimer: {
    fontSize: Typography.size.xs,
    lineHeight: 18,
    color: Colors.textTertiary,
  },
});
