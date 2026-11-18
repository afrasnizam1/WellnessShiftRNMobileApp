import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Screen } from '../../navigation/screenNames';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { format } from 'date-fns';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import type { ClinicianStackParamList, Message, MessageThread } from '../../types';
import { useAppStore } from '../../store';
import { isMessageThreadOpen, messageService } from '../../services/firebase';
import AppScreen from '../../components/common/AppScreen';

type Route = RouteProp<ClinicianStackParamList, typeof Screen.clinicianMessages>;

export default function ClinicianMessagesScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const route = useRoute<Route>();
  const { patient } = route.params;
  const { user } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [thread, setThread] = useState<MessageThread | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const open = isMessageThreadOpen(thread);

  useEffect(() => {
    if (!user) return;
    const unsubMsgs = messageService.watchMessages(patient.uid, user.uid, setMessages);
    const unsubThread = messageService.watchThread(patient.uid, user.uid, setThread);
    return () => {
      unsubMsgs();
      unsubThread();
    };
  }, [user, patient.uid]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      messageService.markMessagesRead(patient.uid, user.uid, user.uid).catch(() => {});
    }, [user, patient.uid])
  );

  const startConversation = async () => {
    if (!user || busy) return;
    setBusy(true);
    try {
      await messageService.startConversation(patient.uid, user.uid);
      setThread((current) => ({
        patientId: patient.uid,
        clinicianId: user.uid,
        startedAt: current?.startedAt ?? new Date().toISOString(),
        startedBy: current?.startedBy ?? user.uid,
        patientUnread: 0,
        clinicianUnread: 0,
        ...current,
        status: 'open',
      }));
    } catch (error) {
      Alert.alert(
        'Could not start chat',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const endConversation = () => {
    if (!user || busy) return;
    Alert.alert(
      'End conversation',
      `End the chat with ${patient.displayName}? They will not be able to send messages until you start again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End chat',
          style: 'destructive',
          onPress: () => {
            setBusy(true);
            messageService
              .endConversation(patient.uid, user.uid)
              .catch((error) => {
                Alert.alert(
                  'Could not end chat',
                  error instanceof Error ? error.message : 'Please try again.',
                );
              })
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  };

  const send = async () => {
    const text = input.trim();
    if (!text || !user || !open || sending) return;
    setInput('');
    setSending(true);
    try {
      await messageService.sendMessage(patient.uid, user.uid, {
        senderId: user.uid,
        senderName: user.displayName,
        content: text,
        timestamp: new Date().toISOString(),
        isRead: false,
        receiverId: patient.uid,
      });
    } catch (error) {
      Alert.alert(
        'Message not sent',
        error instanceof Error ? error.message : 'Please try again.',
      );
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <AppScreen style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{patient.displayName}</Text>
          <Text style={styles.headerSub}>
            {open ? 'Conversation open' : thread?.status === 'closed' ? 'Conversation ended' : 'Not started'}
          </Text>
        </View>
        {open ? (
          <TouchableOpacity
            onPress={endConversation}
            disabled={busy}
            style={styles.endBtn}
            accessibilityRole="button"
            accessibilityLabel="End conversation"
          >
            <Text style={styles.endBtnText}>End</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 48 }} />
        )}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const mine = item.senderId === user?.uid;
            return (
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.content}</Text>
                <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
                  {format(new Date(item.timestamp), 'HH:mm')}
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {open
                ? 'Conversation started. Send a message to your patient.'
                : 'Start a conversation to message this patient. Only you can open and end chats.'}
            </Text>
          }
        />

        {open ? (
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Type a message…"
              placeholderTextColor={Colors.textTertiary}
              returnKeyType="send"
              onSubmitEditing={send}
              editable={!sending}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
              onPress={send}
              disabled={!input.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={styles.sendBtnText}>Send</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.startWrap, { paddingBottom: Math.max(insets.bottom, Spacing.base) }]}>
            <TouchableOpacity
              style={[styles.startBtn, busy && styles.sendBtnDisabled]}
              onPress={startConversation}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={thread?.status === 'closed' ? 'Restart conversation' : 'Start conversation'}
            >
              {busy ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.startBtnText}>
                  {thread?.status === 'closed' ? 'Restart conversation' : 'Start conversation'}
                </Text>
              )}
            </TouchableOpacity>
            <Text style={styles.startHint}>
              Only linked patients can be messaged. Patients cannot start or end chats.
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40 },
  backText: { fontSize: 32, color: Colors.primary, lineHeight: 38 },
  headerInfo: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: Typography.size.base, fontWeight: '700', color: Colors.text },
  headerSub: { fontSize: Typography.size.xs, color: Colors.textSecondary },
  endBtn: {
    minWidth: 48,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.md,
    backgroundColor: Colors.errorLight,
    alignItems: 'center',
  },
  endBtnText: { color: Colors.error, fontWeight: '700', fontSize: Typography.size.sm },
  list: { padding: Spacing.base, gap: Spacing.sm, flexGrow: 1 },
  empty: { textAlign: 'center', color: Colors.textSecondary, marginTop: Spacing.xl, paddingHorizontal: Spacing.lg, lineHeight: 20 },
  bubble: { maxWidth: '80%', borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.sm },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: Colors.primary },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border },
  bubbleText: { fontSize: Typography.size.base, color: Colors.text },
  bubbleTextMine: { color: Colors.white },
  bubbleTime: { fontSize: 10, color: Colors.textTertiary, marginTop: 4, alignSelf: 'flex-end' },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.7)' },
  inputRow: {
    flexDirection: 'row', gap: Spacing.sm, padding: Spacing.base,
    backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.xl,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, color: Colors.text,
  },
  sendBtn: { backgroundColor: Colors.primary, borderRadius: Radius.xl, paddingHorizontal: Spacing.base, justifyContent: 'center', minWidth: 64, alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: Colors.white, fontWeight: '700' },
  startWrap: {
    padding: Spacing.base,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },
  startBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  startBtnText: { color: Colors.white, fontWeight: '700', fontSize: Typography.size.base },
  startHint: {
    fontSize: Typography.size.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
});
