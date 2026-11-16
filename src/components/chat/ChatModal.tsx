//src/components/chat/ChatModal.tsx
import React, {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useSession } from '../../hooks/useSession';

import {
  clearConversationHistory,
  getOrCreateConversation,
  getMessages,
  sendUserMessage,
  type Message,
} from '../../services/chatService';

import { getChatReply } from '../../services/aiService';

// =====================================================
// DESIGN SYSTEM
// =====================================================

const { width: SW, height: SH } = Dimensions.get('window');

const COLORS = {
  background: '#FFF8FC',
  white: '#FFFFFF',
  glass: 'rgba(255,255,255,0.76)',
  glassStrong: 'rgba(255,255,255,0.91)',
  pink: '#E99ABC',
  pinkDeep: '#CE719D',
  pinkLight: '#F9DCE9',
  pinkPale: '#FFF0F6',
  pinkBorder: 'rgba(226,157,188,0.32)',
  glow: '#F4B5D0',
  text: '#493545',
  muted: '#9B8794',
  subtle: '#BDAAB5',
  green: '#55BA91',
  red: '#D86B83',
};

const SUGGESTIONS = [
  { icon: '✧', text: 'How can I improve my skin?' },
  { icon: '♡', text: 'What causes acne?' },
  { icon: '✦', text: 'Build me a skincare routine' },
];

const PARTICLES = [
  { x: 0.08, y: 0.12, size: 5, delay: 0 },
  { x: 0.82, y: 0.09, size: 7, delay: 350 },
  { x: 0.92, y: 0.36, size: 4, delay: 700 },
  { x: 0.12, y: 0.45, size: 6, delay: 1100 },
  { x: 0.74, y: 0.57, size: 4, delay: 500 },
  { x: 0.22, y: 0.76, size: 5, delay: 900 },
  { x: 0.91, y: 0.84, size: 6, delay: 1300 },
  { x: 0.48, y: 0.91, size: 4, delay: 200 },
];

// =====================================================
// ANIMATED PARTICLE
// =====================================================

const Particle = memo(function Particle({
  x,
  y,
  size,
  delay,
}: (typeof PARTICLES)[number]) {
  const motion = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(motion, {
          toValue: 1,
          duration: 2600,
          useNativeDriver: true,
        }),
        Animated.timing(motion, {
          toValue: 0,
          duration: 2600,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [delay, motion]);

  const translateY = motion.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -17],
  });

  const opacity = motion.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.2, 0.85, 0.2],
  });

  const scale = motion.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.75, 1.2, 0.75],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        {
          left: `${x * 100}%`,
          top: `${y * 100}%`,
          width: size,
          height: size,
          borderRadius: size,
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    />
  );
});

// =====================================================
// GLASS BUTTON
// =====================================================

const GlassButton = memo(function GlassButton({
  icon,
  onPress,
  disabled,
  loading,
  accessibilityLabel,
}: {
  icon: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [
        styles.glassButton,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={COLORS.pinkDeep} />
      ) : (
        <Text style={styles.glassButtonIcon}>{icon}</Text>
      )}
    </Pressable>
  );
});

// =====================================================
// MESSAGE BUBBLE
// =====================================================

const MessageBubble = memo(function MessageBubble({
  message,
}: {
  message: Message;
}) {
  const isUser = message.role === 'user';

  return (
    <View
      style={[
        styles.messageRow,
        isUser ? styles.userRow : styles.assistantRow,
      ]}
    >
      {!isUser && (
        <View style={styles.smallAIOrb}>
          <Text style={styles.smallAIOrbText}>✦</Text>
        </View>
      )}

      <View
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.assistantBubble,
        ]}
      >
        {!isUser && (
          <Text style={styles.messageLabel}>SKINAI</Text>
        )}

        <Text
          style={[
            styles.messageText,
            isUser ? styles.userMessageText : styles.assistantMessageText,
          ]}
        >
          {message.content}
        </Text>
      </View>
    </View>
  );
});

// =====================================================
// SUGGESTION CARD
// =====================================================

const SuggestionCard = memo(function SuggestionCard({
  icon,
  text,
  onPress,
  disabled,
}: {
  icon: string;
  text: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.suggestionCard,
        pressed && styles.suggestionPressed,
      ]}
    >
      <View style={styles.suggestionIcon}>
        <Text style={styles.suggestionIconText}>{icon}</Text>
      </View>

      <Text style={styles.suggestionText}>{text}</Text>

      <Text style={styles.suggestionArrow}>↗</Text>
    </Pressable>
  );
});

// =====================================================
// TYPING INDICATOR
// =====================================================

const TypingIndicator = memo(function TypingIndicator() {
  return (
    <View style={styles.messageRow}>
      <View style={styles.smallAIOrb}>
        <Text style={styles.smallAIOrbText}>✦</Text>
      </View>

      <View style={styles.typingBubble}>
        <ActivityIndicator size="small" color={COLORS.pinkDeep} />
        <Text style={styles.typingText}>Thinking...</Text>
      </View>
    </View>
  );
});

// =====================================================
// MAIN COMPONENT
// =====================================================

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
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const closingRef = useRef(false);
  const requestRef = useRef(0);

  const panel = useRef(new Animated.Value(0)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const orb = useRef(new Animated.Value(0)).current;

  const busy = sending || clearing || loading;

  // ===================================================
  // ANIMATION LIFECYCLE
  // ===================================================

  useEffect(() => {
    if (!visible) {
      panel.setValue(0);
      backdrop.setValue(0);
      glow.stopAnimation();
      orb.stopAnimation();
      return;
    }

    closingRef.current = false;

    const entrance = Animated.parallel([
      Animated.spring(panel, {
        toValue: 1,
        damping: 20,
        stiffness: 150,
        mass: 0.8,
        useNativeDriver: true,
      }),
      Animated.timing(backdrop, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]);

    const ambient = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 2400,
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 2400,
          useNativeDriver: true,
        }),
      ]),
    );

    const orbAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(orb, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(orb, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ]),
    );

    entrance.start();
    ambient.start();
    orbAnimation.start();

    return () => {
      ambient.stop();
      orbAnimation.stop();
      entrance.stop();
    };
  }, [visible, panel, backdrop, glow, orb]);

  const closeChat = useCallback(() => {
    if (closingRef.current) return;

    closingRef.current = true;

    Animated.parallel([
      Animated.timing(panel, {
        toValue: 0,
        duration: 190,
        useNativeDriver: true,
      }),
      Animated.timing(backdrop, {
        toValue: 0,
        duration: 190,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        onClose();
        closingRef.current = false;
      }
    });
  }, [panel, backdrop, onClose]);

  // ===================================================
  // LOAD CONVERSATION
  // ===================================================

  useEffect(() => {
    if (!visible || !user?.id) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const conversation = await getOrCreateConversation(user.id);

        if (cancelled) return;

        setConversationId(conversation.id);

        const history = await getMessages(conversation.id);

        if (cancelled) return;

        setMessages(history);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : 'Unable to load your conversation.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [visible, user?.id]);

  // ===================================================
  // AUTO SCROLL
  // ===================================================

  useEffect(() => {
    if (!visible) return;

    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 120);

    return () => clearTimeout(timer);
  }, [messages.length, sending, visible]);

  // ===================================================
  // CLEAR HISTORY
  // ===================================================

  const clearHistory = useCallback(async () => {
    if (!conversationId || busy) return;

    setClearing(true);
    setError(null);

    try {
      await clearConversationHistory(conversationId);

      setMessages([]);
      setInput('');
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : 'Unable to clear chat history.',
      );
    } finally {
      setClearing(false);
    }
  }, [conversationId, busy]);

  const confirmClearHistory = useCallback(() => {
    if (!conversationId || messages.length === 0 || busy) return;

    Alert.alert(
      'Clear conversation?',
      'All messages in this conversation will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear history',
          style: 'destructive',
          onPress: clearHistory,
        },
      ],
    );
  }, [conversationId, messages.length, busy, clearHistory]);

  // ===================================================
  // SEND MESSAGE
  // ===================================================

  const handleSend = useCallback(
    async (suggestion?: string) => {
      const content = (suggestion ?? input).trim();

      if (
        !content ||
        !conversationId ||
        busy ||
        content.length > 500
      ) {
        return;
      }

      const requestId = ++requestRef.current;
      const temporaryId = `temp-${Date.now()}`;

      const optimisticMessage: Message = {
        id: temporaryId,
        conversation_id: conversationId,
        role: 'user',
        content,
        created_at: new Date().toISOString(),
      };

      setSending(true);
      setError(null);
      setInput('');
      setMessages(current => [...current, optimisticMessage]);

      try {
        const savedMessage = await sendUserMessage(
          conversationId,
          content,
        );

        setMessages(current =>
          current.map(message =>
            message.id === temporaryId ? savedMessage : message,
          ),
        );

        const reply = await getChatReply(conversationId, content);

        if (requestId !== requestRef.current) return;

        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          conversation_id: conversationId,
          role: 'assistant',
          content: reply,
          created_at: new Date().toISOString(),
        };

        setMessages(current => [...current, assistantMessage]);
      } catch (e: unknown) {
        if (requestId === requestRef.current) {
          setError(
            e instanceof Error
              ? e.message
              : 'Failed to send your message.',
          );
        }
      } finally {
        if (requestId === requestRef.current) {
          setSending(false);
        }
      }
    },
    [input, conversationId, busy],
  );

  // ===================================================
  // ANIMATED VALUES
  // ===================================================

  const panelTranslate = panel.interpolate({
    inputRange: [0, 1],
    outputRange: [55, 0],
  });

  const panelScale = panel.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
  });

  const backdropOpacity = backdrop.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.32],
  });

  const glowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.8],
  });

  const orbScale = orb.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.09],
  });

  const orbOpacity = orb.interpolate({
    inputRange: [0, 1],
    outputRange: [0.75, 1],
  });

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={closeChat}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.backdrop, { opacity: backdropOpacity }]}
        />

        <Pressable
          style={styles.backdropTouch}
          onPress={closeChat}
          accessibilityLabel="Close chat"
        />

        <Animated.View
          pointerEvents="none"
          style={[
            styles.glowFrame,
            {
              opacity: glowOpacity,
              transform: [{ translateY: panelTranslate }],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.panel,
            {
              opacity: panel,
              transform: [
                { translateY: panelTranslate },
                { scale: panelScale },
              ],
            },
          ]}
        >
          {/* AMBIENT BACKGROUND */}

          <View pointerEvents="none" style={styles.ambient}>
            <View style={styles.ambientPink} />
            <View style={styles.ambientWhite} />

            {PARTICLES.map((particle, index) => (
              <Particle key={index} {...particle} />
            ))}
          </View>

          {/* HEADER */}

          <View style={styles.header}>
            <View style={styles.headerIdentity}>
              <Animated.View
                style={[
                  styles.aiOrb,
                  {
                    opacity: orbOpacity,
                    transform: [{ scale: orbScale }],
                  },
                ]}
              >
                <View style={styles.aiOrbInner}>
                  <Text style={styles.aiOrbIcon}>✦</Text>
                </View>
                <View style={styles.onlineDot} />
              </Animated.View>

              <View style={styles.headerInfo}>
                <View style={styles.titleLine}>
                  <Text style={styles.title}>Skin Advisor</Text>
                  <View style={styles.aiBadge}>
                    <Text style={styles.aiBadgeText}>AI</Text>
                  </View>
                </View>

                <Text style={styles.subtitle}>
                  {sending
                    ? 'Thinking about your question...'
                    : 'Your personal skin companion'}
                </Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              <GlassButton
                icon="⌫"
                onPress={confirmClearHistory}
                disabled={!messages.length || busy}
                loading={clearing}
                accessibilityLabel="Clear chat history"
              />

              <GlassButton
                icon="×"
                onPress={closeChat}
                accessibilityLabel="Close chat"
              />
            </View>
          </View>

          {/* AI STATUS */}

          <View style={styles.statusStrip}>
            <View style={styles.statusLeft}>
              <Text style={styles.statusSparkle}>✧</Text>
              <Text style={styles.statusLabel}>SKINAI INTELLIGENCE</Text>
            </View>

            <View style={styles.readyStatus}>
              <View style={styles.readyDot} />
              <Text style={styles.readyText}>
                {busy ? 'WORKING' : 'READY'}
              </Text>
            </View>
          </View>

          {/* CHAT BODY */}

          <ScrollView
            ref={scrollRef}
            style={styles.messages}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {loading && (
              <View style={styles.loadingContainer}>
                <View style={styles.loadingOrb}>
                  <Text style={styles.loadingIcon}>✦</Text>
                </View>

                <ActivityIndicator color={COLORS.pinkDeep} />

                <Text style={styles.loadingText}>
                  Preparing your assistant...
                </Text>
              </View>
            )}

            {!loading && messages.length === 0 && (
              <View style={styles.welcome}>
                <Animated.View
                  style={[
                    styles.welcomeOrb,
                    {
                      transform: [{ scale: orbScale }],
                      opacity: orbOpacity,
                    },
                  ]}
                >
                  <View style={styles.welcomeOrbInner}>
                    <Text style={styles.welcomeOrbIcon}>✦</Text>
                  </View>
                  <View style={styles.orbitDot} />
                </Animated.View>

                <Text style={styles.eyebrow}>
                  YOUR PERSONAL SKIN COMPANION
                </Text>

                <Text style={styles.welcomeTitle}>
                  Let's talk
                  <Text style={styles.welcomeAccent}> skincare.</Text>
                </Text>

                <Text style={styles.welcomeDescription}>
                  Explore skincare ingredients, routines, skin concerns
                  and your analysis results with your AI assistant.
                </Text>

                <View style={styles.suggestionHeading}>
                  <Text style={styles.suggestionLabel}>SUGGESTED TOPICS</Text>
                  <Text style={styles.suggestionDecoration}>✧</Text>
                </View>

                {SUGGESTIONS.map(item => (
                  <SuggestionCard
                    key={item.text}
                    icon={item.icon}
                    text={item.text}
                    disabled={!conversationId || busy}
                    onPress={() => handleSend(item.text)}
                  />
                ))}
              </View>
            )}

            {messages.map(message => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {sending && <TypingIndicator />}

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorIcon}>!</Text>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </ScrollView>

          {/* INPUT AREA */}

          <View style={styles.inputSection}>
            <View style={styles.inputHeader}>
              <Text style={styles.inputLabel}>MESSAGE SKINAI</Text>
              <Text style={styles.counter}>{input.length}/500</Text>
            </View>

            <View style={styles.inputGlass}>
              <Text style={styles.inputDecoration}>✧</Text>

              <TextInput
                style={styles.input}
                placeholder="Ask about your skin..."
                placeholderTextColor={COLORS.subtle}
                value={input}
                onChangeText={setInput}
                multiline
                maxLength={500}
                editable={!busy && !!conversationId}
              />

              <Pressable
                onPress={() => handleSend()}
                disabled={!input.trim() || busy || !conversationId}
                accessibilityRole="button"
                accessibilityLabel="Send message"
                style={({ pressed }) => [
                  styles.sendButton,
                  (!input.trim() || busy || !conversationId) &&
                    styles.sendDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.sendIcon}>↑</Text>
              </Pressable>
            </View>

            <View style={styles.disclaimer}>
              <Text style={styles.disclaimerIcon}>✦</Text>
              <Text style={styles.disclaimerText}>
                Informational skincare guidance, not a medical diagnosis.
              </Text>
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// =====================================================
// RESPONSIVE DIMENSIONS
// =====================================================

const PANEL_WIDTH = Math.min(SW - 28, 440);
const PANEL_HEIGHT = Math.min(SH * 0.78, 730);
const PANEL_BOTTOM = Platform.OS === 'android' ? 85 : 95;

// =====================================================
// REUSABLE STYLES
// =====================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#513C4B',
  },

  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },

  panel: {
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    marginRight: 14,
    marginBottom: PANEL_BOTTOM,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
    elevation: 20,
    shadowColor: '#D58EAF',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 25,
  },

  glowFrame: {
    position: 'absolute',
    width: PANEL_WIDTH + 7,
    height: PANEL_HEIGHT + 7,
    marginRight: 10,
    marginBottom: PANEL_BOTTOM - 3,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: COLORS.glow,
    shadowColor: COLORS.pink,
    shadowOpacity: 0.65,
    shadowRadius: 19,
    elevation: 14,
  },

  // AMBIENT BACKGROUND

  ambient: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#FFF9FC',
  },

  ambientPink: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 110,
    backgroundColor: 'rgba(250,207,225,0.38)',
    top: -100,
    right: -75,
  },

  ambientWhite: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.75)',
    bottom: -100,
    left: -65,
  },

  particle: {
    position: 'absolute',
    backgroundColor: '#EBA6C6',
    shadowColor: '#EBA6C6',
    shadowOpacity: 0.65,
    shadowRadius: 8,
    elevation: 3,
  },

  // HEADER

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.pinkBorder,
  },

  headerIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  aiOrb: {
    width: 47,
    height: 47,
    borderRadius: 17,
    backgroundColor: 'rgba(249,220,234,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(225,160,191,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.pink,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },

  aiOrbInner: {
    width: 35,
    height: 35,
    borderRadius: 13,
    backgroundColor: '#E99CBD',
    alignItems: 'center',
    justifyContent: 'center',
  },

  aiOrbIcon: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: '900',
  },

  onlineDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    right: -2,
    bottom: -1,
    backgroundColor: COLORS.green,
    borderWidth: 2,
    borderColor: COLORS.white,
  },

  headerInfo: {
    flex: 1,
    marginLeft: 11,
  },

  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  title: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },

  aiBadge: {
    marginLeft: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: COLORS.pinkPale,
    borderWidth: 1,
    borderColor: COLORS.pinkBorder,
  },

  aiBadgeText: {
    color: COLORS.pinkDeep,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  subtitle: {
    fontSize: 10,
    color: COLORS.muted,
    marginTop: 4,
  },

  headerActions: {
    flexDirection: 'row',
    gap: 7,
    marginLeft: 7,
  },

  glassButton: {
    width: 35,
    height: 35,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: COLORS.pinkBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  glassButtonIcon: {
    fontSize: 21,
    color: COLORS.pinkDeep,
  },

  disabled: {
    opacity: 0.35,
  },

  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },

  // STATUS STRIP

  statusStrip: {
    height: 31,
    paddingHorizontal: 15,
    backgroundColor: 'rgba(255,255,255,0.48)',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.pinkBorder,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  statusSparkle: {
    fontSize: 13,
    color: COLORS.pinkDeep,
    marginRight: 6,
  },

  statusLabel: {
    fontSize: 8,
    letterSpacing: 1.2,
    fontWeight: '900',
    color: '#AE8198',
  },

  readyStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  readyDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.green,
    marginRight: 5,
  },

  readyText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
    color: COLORS.green,
  },

  // CHAT

  messages: {
    flex: 1,
    paddingHorizontal: 13,
  },

  messagesContent: {
    flexGrow: 1,
    paddingTop: 17,
    paddingBottom: 15,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingOrb: {
    width: 58,
    height: 58,
    borderRadius: 21,
    backgroundColor: COLORS.pinkLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },

  loadingIcon: {
    fontSize: 30,
    color: COLORS.pinkDeep,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 11,
    color: COLORS.muted,
  },

  // WELCOME

  welcome: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 10,
  },

  welcomeOrb: {
    width: 85,
    height: 85,
    borderRadius: 30,
    backgroundColor: 'rgba(249,221,235,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(225,160,191,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    shadowColor: COLORS.pink,
    shadowOpacity: 0.42,
    shadowRadius: 20,
    elevation: 7,
  },

  welcomeOrbInner: {
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: '#E99CBD',
    justifyContent: 'center',
    alignItems: 'center',
  },

  welcomeOrbIcon: {
    color: COLORS.white,
    fontSize: 38,
    fontWeight: '900',
  },

  orbitDot: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F2B3CE',
    borderWidth: 2,
    borderColor: COLORS.white,
  },

  eyebrow: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.8,
    color: COLORS.pinkDeep,
    marginBottom: 8,
  },

  welcomeTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -0.7,
    textAlign: 'center',
  },

  welcomeAccent: {
    color: COLORS.pinkDeep,
  },

  welcomeDescription: {
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
    color: COLORS.muted,
    marginTop: 10,
    marginBottom: 22,
    paddingHorizontal: 9,
  },

  suggestionHeading: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 3,
    marginBottom: 9,
  },

  suggestionLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    color: '#A98599',
  },

  suggestionDecoration: {
    fontSize: 17,
    color: COLORS.pinkDeep,
  },

  suggestionCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 11,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(230,184,207,0.48)',
    marginBottom: 8,
    shadowColor: '#DCA0BA',
    shadowOpacity: 0.07,
    shadowRadius: 7,
    elevation: 2,
  },

  suggestionPressed: {
    backgroundColor: '#FFF0F6',
    borderColor: COLORS.pink,
  },

  suggestionIcon: {
    width: 30,
    height: 30,
    borderRadius: 11,
    backgroundColor: COLORS.pinkPale,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  suggestionIconText: {
    fontSize: 17,
    color: COLORS.pinkDeep,
  },

  suggestionText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#684E5E',
  },

  suggestionArrow: {
    fontSize: 17,
    color: COLORS.pinkDeep,
    marginLeft: 7,
  },

  // MESSAGE BUBBLES

  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 13,
  },

  userRow: {
    justifyContent: 'flex-end',
  },

  assistantRow: {
    justifyContent: 'flex-start',
  },

  smallAIOrb: {
    width: 27,
    height: 27,
    borderRadius: 10,
    backgroundColor: COLORS.pinkPale,
    borderWidth: 1,
    borderColor: COLORS.pinkBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
    marginBottom: 2,
  },

  smallAIOrbText: {
    fontSize: 16,
    color: COLORS.pinkDeep,
    fontWeight: '900',
  },

  messageBubble: {
    maxWidth: '84%',
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 17,
  },

  userBubble: {
    backgroundColor: '#E99CBD',
    borderWidth: 1,
    borderColor: '#EBAFC9',
    borderBottomRightRadius: 5,
  },

  assistantBubble: {
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(230,184,207,0.42)',
    borderBottomLeftRadius: 5,
    shadowColor: '#DCA0BA',
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 1,
  },

  messageLabel: {
    color: COLORS.pinkDeep,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 6,
  },

  messageText: {
    fontSize: 12,
    lineHeight: 19,
  },

  userMessageText: {
    color: COLORS.white,
  },

  assistantMessageText: {
    color: '#584351',
  },

  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: 1,
    borderColor: COLORS.pinkBorder,
    borderRadius: 15,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },

  typingText: {
    marginLeft: 8,
    color: COLORS.muted,
    fontSize: 10,
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 11,
    borderRadius: 12,
    backgroundColor: '#FFF0F2',
    borderWidth: 1,
    borderColor: '#F3CDD4',
    marginVertical: 8,
  },

  errorIcon: {
    color: COLORS.red,
    fontSize: 15,
    fontWeight: '900',
    marginRight: 9,
  },

  errorText: {
    flex: 1,
    color: '#A94B5B',
    fontSize: 10,
    lineHeight: 15,
  },

  // INPUT

  inputSection: {
    paddingHorizontal: 12,
    paddingTop: 11,
    paddingBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderTopWidth: 1,
    borderTopColor: COLORS.pinkBorder,
  },

  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 3,
  },

  inputLabel: {
    color: '#A98599',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  counter: {
    color: COLORS.subtle,
    fontSize: 8,
  },

  inputGlass: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 5,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(225,160,191,0.55)',
    borderRadius: 19,
    shadowColor: COLORS.pink,
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 3,
  },

  inputDecoration: {
    width: 32,
    height: 36,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 19,
    color: COLORS.pinkDeep,
  },

  input: {
    flex: 1,
    minHeight: 39,
    maxHeight: 90,
    paddingHorizontal: 7,
    paddingVertical: 9,
    fontSize: 12,
    color: COLORS.text,
  },

  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#E99CBD',
    borderWidth: 1,
    borderColor: '#F0B7D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 5,
    shadowColor: COLORS.pink,
    shadowOpacity: 0.35,
    shadowRadius: 7,
    elevation: 4,
  },

  sendDisabled: {
    opacity: 0.35,
    shadowOpacity: 0,
  },

  sendIcon: {
    fontSize: 23,
    fontWeight: '900',
    color: COLORS.white,
  },

  disclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 9,
  },

  disclaimerIcon: {
    fontSize: 9,
    color: COLORS.pinkDeep,
    marginRight: 5,
  },

  disclaimerText: {
    fontSize: 8,
    color: '#AC98A4',
    textAlign: 'center',
  },
});
