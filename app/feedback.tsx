import { useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useStyles, useTokens } from '../src/theme';
import type { ThemeTokens } from '../src/theme';
import {
  FEEDBACK_PRIORITIES,
  FEEDBACK_MESSAGE_MAX,
  submitFeedback,
} from '../src/services/feedback';

export default function FeedbackScreen() {
  const router = useRouter();
  const styles = useStyles(createStyles);
  const tokens = useTokens();

  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [contactOk, setContactOk] = useState(false);
  const [sending, setSending] = useState(false);

  const canSend = !sending && (selected.length > 0 || message.trim().length > 0);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  const handleSend = async () => {
    setSending(true);
    const ok = await submitFeedback({ priorities: selected, message, contactOk });
    setSending(false);
    if (ok) {
      Alert.alert('Thank you', 'Your feedback was sent. It directly shapes what we build next.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else {
      Alert.alert('Not sent', 'Something went wrong. Check your connection and try again.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>What matters most to you?</Text>
      <Text style={styles.subtitle}>Pick anything that applies. We read every response.</Text>

      <View style={styles.card}>
        {FEEDBACK_PRIORITIES.map((p) => {
          const on = selected.includes(p.id);
          return (
            <Pressable
              key={p.id}
              style={styles.row}
              onPress={() => toggle(p.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
            >
              <Text style={styles.label}>{p.label}</Text>
              <Text style={[styles.check, on && styles.checkOn]}>{on ? '☑' : '☐'}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>{'ANYTHING ELSE?'}</Text>
      <TextInput
        style={styles.input}
        multiline
        maxLength={FEEDBACK_MESSAGE_MAX}
        placeholder="What would make WeatherBeacon more useful for you?"
        placeholderTextColor={tokens.textTertiary}
        value={message}
        onChangeText={setMessage}
        textAlignVertical="top"
      />
      <Text style={styles.counter}>
        {message.length}/{FEEDBACK_MESSAGE_MAX}
      </Text>

      <Pressable
        style={styles.row}
        onPress={() => setContactOk((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: contactOk }}
      >
        <Text style={styles.label}>It's OK to email me about this</Text>
        <Text style={[styles.check, contactOk && styles.checkOn]}>{contactOk ? '☑' : '☐'}</Text>
      </Pressable>

      <Pressable
        style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
        onPress={handleSend}
        disabled={!canSend}
      >
        {sending ? (
          <ActivityIndicator color={tokens.textOnPrimary} />
        ) : (
          <Text style={styles.sendButtonText}>Send Feedback</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const createStyles = (t: ThemeTokens) => ({
  container: { flex: 1 as const, backgroundColor: t.background },
  content: { padding: 20, paddingBottom: 60, maxWidth: 600, alignSelf: 'center' as const, width: '100%' as const },
  title: { fontSize: 22, fontWeight: '700' as const, color: t.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 14, color: t.textSecondary, marginBottom: 16 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: t.textTertiary,
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
  },
  card: {
    backgroundColor: t.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: t.borderLight,
  },
  row: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 10,
  },
  label: { fontSize: 15, color: t.textPrimary, flex: 1 as const, marginRight: 12 },
  check: { fontSize: 20, color: t.textTertiary },
  checkOn: { color: t.primary },
  input: {
    minHeight: 120,
    backgroundColor: t.inputBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.border,
    padding: 12,
    fontSize: 15,
    color: t.textPrimary,
  },
  counter: { fontSize: 12, color: t.textTertiary, alignSelf: 'flex-end' as const, marginTop: 4, marginBottom: 8 },
  sendButton: {
    backgroundColor: t.primary,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    alignItems: 'center' as const,
  },
  sendButtonDisabled: { backgroundColor: t.primaryDisabled },
  sendButtonText: { color: t.textOnPrimary, fontSize: 16, fontWeight: '700' as const },
});
