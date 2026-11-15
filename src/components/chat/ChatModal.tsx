import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { theme } from '../../constants/theme';
import { useSession } from '../../hooks/useSession';
import {
  getOrCreateConversation,
  getMessages,
  sendUserMessage,
} from '../../services/chatService';
import { getChatReply } from '../../services/aiService';
import type { Database } from '../../types/database';

type Message = Database['public']['Tables']['messages']['Row'];

export default function ChatModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { user } = useSession();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!visible || !user) return;
    setLoading(true);
    setError(null);
    getOrCreateConversation(user.id)
      .then(async (conv) => {
        setConversationId(conv.id);
        const msgs = await getMessages(conv.id);
        setMessages(msgs);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [visible, user]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  async function handleSend() {
    const text = input.trim();
    if (!text || !conversationId || sending) return;
    setSending(true);
    setError(null);
    setInput('');

    // Optimistic append of the user's message
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      conversation_id: conversationId,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);

    try {
      const saved = await sendUserMessage(conversationId, text);
      setMessages((m) => m.map((x) => (x.id === tempId ? saved : x)));

      const reply = await getChatReply(conversationId, text);

      // The assistant reply is inserted server-side normally, but for the
      // stub we just append locally. When the Edge Function is live, it
      // will write the assistant row and we'll refetch instead.
      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        conversation_id: conversationId,
        role: 'assistant',
        content: reply,
        created_at: new Date().toISOString(),
      };
      setMessages((m) => [...m, assistantMsg]);
    } catch (e: any) {
      setError(e.message ?? 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Skin Advisor</Text>
              <Text style={styles.subtitle}>
                {sending ? 'Thinking…' : 'Online'}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <Text style={styles.closeText}>Done</Text>
            </Pressable>
          </View>

          {/* Messages */}
          <ScrollView
            ref={scrollRef}
            style={styles.messages}
            contentContainerStyle={{ paddingVertical: 12 }}
          >
            {loading && (
              <View style={styles.center}>
                <ActivityIndicator />
              </View>
            )}

            {!loading && messages.length === 0 && (
              <View style={styles.center}>
                <Text style={styles.emptyTitle}>Hi! Ask me anything</Text>
                <Text style={styles.emptyBody}>
                  Try: "What should I use for dry skin?" or "Explain my last scan"
                </Text>
              </View>
            )}

            {messages.map((m) => (
              <View
                key={m.id}
                style={[
                  styles.bubble,
                  m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
                ]}
              >
                <Text
                  style={
                    m.role === 'user'
                      ? styles.bubbleTextUser
                      : styles.bubbleTextAssistant
                  }
                >
                  {m.content}
                </Text>
              </View>
            ))}

            {sending && (
              <View style={[styles.bubble, styles.bubbleAssistant]}>
                <ActivityIndicator size="small" color={theme.colors.textMuted} />
              </View>
            )}

            {error && <Text style={styles.errorText}>{error}</Text>}
          </ScrollView>

          {/* Input */}
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              placeholder="Type a message…"
              placeholderTextColor={theme.colors.textMuted}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={500}
            />
            <Pressable
              onPress={handleSend}
              disabled={!input.trim() || sending}
              style={[
                styles.sendBtn,
                (!input.trim() || sending) && styles.sendBtnDisabled,
              ]}
            >
              <Text style={styles.sendText}>↑</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  title: { fontSize: 17, fontWeight: '700' },
  subtitle: { fontSize: 12, color: theme.colors.success, marginTop: 2 },
  closeBtn: { padding: 6 },
  closeText: { color: theme.colors.primary, fontWeight: '600', fontSize: 16 },
  messages: { flex: 1, paddingHorizontal: 16 },
  center: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  emptyBody: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center' },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    marginVertical: 4,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.surface,
    borderBottomLeftRadius: 4,
  },
  bubbleTextUser: { color: '#fff', fontSize: 15, lineHeight: 20 },
  bubbleTextAssistant: { color: theme.colors.text, fontSize: 15, lineHeight: 20 },
  errorText: { color: theme.colors.danger, fontSize: 12, textAlign: 'center', marginTop: 8 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    fontSize: 15,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendText: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: -2 },
});