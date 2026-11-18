import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Share,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import { SegmentedControl } from '../../components/ui';
import { useAppStore } from '../../store';
import { clinicianService } from '../../services/clinicianService';
import AppScreen from '../../components/common/AppScreen';

type Mode = 'Invite code' | 'Email';

function formatInviteCode(code: string): string {
  const raw = code.replace(/\s+/g, '').toUpperCase();
  if (raw.length <= 4) return raw;
  return `${raw.slice(0, Math.ceil(raw.length / 2))} ${raw.slice(Math.ceil(raw.length / 2))}`;
}

export default function AddPatientScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAppStore();
  const [mode, setMode] = useState<Mode>('Invite code');
  const [email, setEmail] = useState('');
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [loadingCode, setLoadingCode] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.uid) {
        setLoadingCode(false);
        return;
      }
      try {
        const code = await clinicianService.ensureInviteCode(user.uid);
        if (!cancelled) setInviteCode(code);
      } catch (err: any) {
        if (!cancelled) {
          Alert.alert('Could not load invite code', err?.message ?? 'Please try again.');
        }
      } finally {
        if (!cancelled) setLoadingCode(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const shareInviteCode = useCallback(() => {
    if (!inviteCode) return;
    Share.share({
      message: `Join my care team on Wellness Shift. Use invite code: ${inviteCode}`,
    }).catch(() => {});
  }, [inviteCode]);

  const handleSendEmail = async () => {
    if (!user || !email.trim()) return;
    setSending(true);
    try {
      const result = await clinicianService.sendConnectionRequest(user.uid, email.trim());
      if (result.alreadyLinked) {
        Alert.alert(
          'Already connected',
          'This patient was already linked to you (the list may have been out of sync). Check Patients — they should appear there now.',
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
      } else {
        Alert.alert(
          'Request sent',
          'The patient will see your connection request in their app. They can approve or decline.',
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
      }
    } catch (err: any) {
      Alert.alert('Could not send request', err.message ?? 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <AppScreen style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button">
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add patient</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.hint}>
            Connect a patient with your invite code, or send a request to the email they used to sign up.
          </Text>

          <SegmentedControl
            options={['Invite code', 'Email'] as Mode[]}
            value={mode}
            onChange={setMode}
          />

          {mode === 'Invite code' ? (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Share your invite code</Text>
              <Text style={styles.panelBody}>
                Give this code to your patient. They enter it under More → My Care → Connect with invite code.
              </Text>

              {loadingCode ? (
                <ActivityIndicator color={Colors.brand} style={styles.codeLoader} />
              ) : inviteCode ? (
                <>
                  <View style={styles.codeBox}>
                    <Text
                      style={styles.codeValue}
                      selectable
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      {formatInviteCode(inviteCode)}
                    </Text>
                  </View>

                  <TouchableOpacity style={styles.btn} onPress={shareInviteCode} accessibilityRole="button">
                    <Ionicons name="share-outline" size={18} color={Colors.white} />
                    <Text style={styles.btnText}>Share invite code</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.errorText}>Invite code unavailable. Try again from Settings.</Text>
              )}
            </View>
          ) : (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Send a connection request</Text>
              <Text style={styles.panelBody}>
                Enter the email address your patient used to sign up. They’ll get a request to approve in the app.
              </Text>

              <Text style={styles.label}>Patient email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="patient@email.com"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
              />

              <TouchableOpacity
                style={[styles.btn, (sending || !email.trim()) && styles.btnDisabled]}
                onPress={handleSendEmail}
                disabled={sending || !email.trim()}
                accessibilityRole="button"
              >
                {sending ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.btnText}>Send connection request</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 40 },
  backText: { fontSize: 32, color: Colors.primary, lineHeight: 38 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: Typography.size.base,
    fontWeight: '700',
    color: Colors.text,
  },
  body: { padding: Spacing.base, gap: Spacing.md, paddingBottom: Spacing['4xl'] },
  hint: { fontSize: Typography.size.sm, color: Colors.textSecondary, lineHeight: 20 },
  panel: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  panelTitle: { fontSize: Typography.size.base, fontWeight: '700', color: Colors.text },
  panelBody: { fontSize: Typography.size.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.xs },
  codeLoader: { marginVertical: Spacing.lg },
  codeBox: {
    backgroundColor: Colors.primaryBg,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.base,
    alignItems: 'center',
    marginVertical: Spacing.xs,
  },
  codeValue: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 2,
    color: Colors.text,
  },
  label: { fontSize: Typography.size.sm, fontWeight: '600', color: Colors.text, marginTop: Spacing.xs },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    fontSize: Typography.size.base,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  btn: {
    backgroundColor: Colors.brand,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: Colors.white, fontWeight: '700', fontSize: Typography.size.base },
  errorText: { fontSize: Typography.size.sm, color: Colors.error, lineHeight: 20 },
});
