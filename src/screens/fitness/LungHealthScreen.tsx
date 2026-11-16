import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors, Typography, Spacing, Radius, tabBarScrollPadding } from '../../theme';
import { AppCard, ScreenHeader } from '../../components/ui';
import AppScreen from '../../components/common/AppScreen';
import InteractiveLungDiagram from '../../components/fitness/InteractiveLungDiagram';

const SECTIONS = [
  {
    title: 'What lung cancer is',
    body: 'Lung cancer starts when cells in the lungs grow out of control. It often begins in the airways or in the tiny air sacs shown as orange clusters on the diagram. It is the leading cause of cancer-related death worldwide, partly because it can grow quietly before symptoms show.',
  },
  {
    title: 'What raises risk',
    body: 'Tobacco smoking causes most lung cancers. Risk also rises with second-hand smoke, radon gas in some homes, asbestos and certain workplace dusts, outdoor air pollution, previous chest radiotherapy, and a strong family history. Age matters too — it is more common later in life.',
  },
  {
    title: 'Prevention that actually helps',
    points: [
      'Do not start smoking. If you smoke, stopping is the single most effective step — risk starts to fall after you quit, and a GP or local stop-smoking service can help.',
      'Avoid other people’s smoke at home and in the car.',
      'At work, use the protective kit you are given around dust, fumes, and asbestos. Do not disturb old asbestos yourself.',
      'If you are offered a radon test for your home, take it. Ventilation and simple building fixes can lower high levels.',
      'On high-pollution days, cut long outdoor exertion if you already have a lung condition, and keep indoor air as clean as you reasonably can.',
      'Stay active and treat chest infections rather than ignoring a cough that will not settle. These do not “prevent cancer” on their own, but they support the lungs you have.',
    ],
  },
  {
    title: 'Symptoms worth a GP appointment',
    body: 'Contact a doctor if you have a cough that lasts more than three weeks, cough up blood, feel more breathless than usual, have chest or shoulder pain that does not go away, a hoarse voice, repeated chest infections, or unexplained weight loss and tiredness. None of these prove cancer. They are reasons to be examined.',
  },
  {
    title: 'Checks and screening',
    body: 'There is no universal lung scan for everyone. In parts of the UK, the NHS invites some people aged about 55–74 who smoke or used to smoke for a lung health check. If you get an invite, it is worth attending. If you are worried and have not been invited, ask your GP what is appropriate for you — do not buy a private scan because an app suggested it.',
  },
];

export default function LungHealthScreen() {
  const navigation = useNavigation<any>();
  const [showDiagramNote, setShowDiagramNote] = useState(true);

  return (
    <AppScreen style={styles.safe}>
      <ScreenHeader
        title="Lung cancer"
        subtitle="Risks, prevention, and when to get checked"
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <InteractiveLungDiagram />

        <AppCard style={styles.callout}>
          <Text style={styles.calloutLead}>
            <Text style={styles.calloutAccent}>Lung cancer </Text>
            is the leading cause of cancer-related death worldwide.
          </Text>
          <Text style={styles.calloutBody}>
            Most of that risk is preventable. Smoke and polluted air travel down the coloured airways and reach the orange air sacs. That is why quitting smoking protects so much of the lung, not just the throat.
          </Text>
          <Text
            style={styles.more}
            onPress={() => setShowDiagramNote((v) => !v)}
            accessibilityRole="button"
          >
            {showDiagramNote ? 'Hide diagram note' : 'How to read the diagram'}
          </Text>
          {showDiagramNote ? (
            <Text style={styles.calloutBody}>
              Tap Airways or Alveoli. Airways are the branching tubes. Alveoli are the sacs where oxygen enters the blood. Cancer can start in either place. This picture is a teaching diagram, not a scan of your lungs.
            </Text>
          ) : null}
        </AppCard>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.fact}>
            <Text style={styles.factTitle}>{section.title}</Text>
            {'body' in section && section.body ? (
              <Text style={styles.factBody}>{section.body}</Text>
            ) : null}
            {'points' in section && section.points
              ? section.points.map((point) => (
                  <View key={point} style={styles.pointRow}>
                    <View style={styles.bullet} />
                    <Text style={styles.factBody}>{point}</Text>
                  </View>
                ))
              : null}
          </View>
        ))}

        <Text style={styles.disclaimer}>
          Education only — not a diagnosis, screening result, or personal medical advice. In an emergency call 999. For urgent but non-life-threatening concerns in the UK, use NHS 111 or speak to your GP.
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
  more: {
    fontSize: Typography.size.sm,
    fontWeight: '700',
    color: '#E85A4F',
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
  disclaimer: {
    fontSize: Typography.size.xs,
    lineHeight: 18,
    color: Colors.textTertiary,
  },
});
