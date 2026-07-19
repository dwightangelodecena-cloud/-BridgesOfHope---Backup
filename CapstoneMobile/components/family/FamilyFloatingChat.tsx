import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
  Image,
  Animated,
  Easing,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSupportChatMobile } from '../../lib/useSupportChatMobile';

const NAV_CLEARANCE = 72;
const SHEET_HEIGHT = Math.min(560, Dimensions.get('window').height * 0.82);
const SCROLL_BOTTOM_THRESHOLD = 72;
const OPEN_DURATION = 280;
const CLOSE_DURATION = 220;

function triggerChatHaptic() {
  if (Platform.OS === 'web') return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function ChatBrandMark() {
  return (
    <View style={styles.brandAvatar}>
      <Image
        source={require('../../assets/images/BRIDGESOFHOPELOGO.png')}
        style={styles.brandLogo}
        resizeMode="contain"
        accessibilityLabel="Bridges of Hope logo"
      />
    </View>
  );
}

function TypingIndicator() {
  return (
    <View style={styles.typingBubble}>
      <View style={styles.typingDots}>
        <View style={[styles.typingDot, styles.typingDot1]} />
        <View style={[styles.typingDot, styles.typingDot2]} />
        <View style={[styles.typingDot, styles.typingDot3]} />
      </View>
    </View>
  );
}

export function FamilyFloatingChat() {
  const insets = useSafeAreaInsets();
  const [input, setInput] = React.useState('');
  const scrollRef = useRef<ScrollView>(null);
  const isNearBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const wasChatOpenRef = useRef(false);
  const [modalVisible, setModalVisible] = React.useState(false);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const fabScale = useRef(new Animated.Value(1)).current;
  const {
    messages,
    loading,
    sending,
    sendError,
    unreadCount,
    isChatOpen,
    setIsChatOpen,
    sendMessage,
  } = useSupportChatMobile();

  const scrollToEnd = useCallback((animated = true) => {
    scrollRef.current?.scrollToEnd({ animated });
  }, []);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom =
      contentSize.height - layoutMeasurement.height - contentOffset.y;
    isNearBottomRef.current = distanceFromBottom <= SCROLL_BOTTOM_THRESHOLD;
  }, []);

  useEffect(() => {
    if (!isChatOpen) {
      wasChatOpenRef.current = false;
      prevMessageCountRef.current = 0;
      isNearBottomRef.current = true;
      return;
    }

    const justOpened = !wasChatOpenRef.current;
    wasChatOpenRef.current = true;

    const prevCount = prevMessageCountRef.current;
    const count = messages.length;
    prevMessageCountRef.current = count;

    const last = messages[count - 1];
    const hasNewMessages = count > prevCount;
    const shouldScroll =
      justOpened ||
      (hasNewMessages && (isNearBottomRef.current || last?.sender === 'user'));

    if (!shouldScroll) return;

    const t = setTimeout(() => scrollToEnd(!justOpened), justOpened ? 100 : 80);
    return () => clearTimeout(t);
  }, [messages, isChatOpen, scrollToEnd]);

  useEffect(() => {
    if (!isChatOpen || !sending || !isNearBottomRef.current) return;
    const t = setTimeout(() => scrollToEnd(true), 80);
    return () => clearTimeout(t);
  }, [sending, isChatOpen, scrollToEnd]);

  const closeChat = useCallback(() => {
    setIsChatOpen(false);
  }, [setIsChatOpen]);

  const openChat = useCallback(() => {
    triggerChatHaptic();
    Animated.sequence([
      Animated.timing(fabScale, {
        toValue: 0.9,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(fabScale, {
        toValue: 1,
        speed: 22,
        bounciness: 6,
        useNativeDriver: true,
      }),
    ]).start();
    setIsChatOpen(true);
  }, [fabScale, setIsChatOpen]);

  useEffect(() => {
    if (isChatOpen) {
      setModalVisible(true);
      backdropOpacity.setValue(0);
      sheetTranslateY.setValue(SHEET_HEIGHT);
      sheetOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: OPEN_DURATION,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          damping: 22,
          stiffness: 240,
          mass: 0.85,
          useNativeDriver: true,
        }),
        Animated.timing(sheetOpacity, {
          toValue: 1,
          duration: OPEN_DURATION - 40,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    if (!modalVisible) return;

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: CLOSE_DURATION,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: SHEET_HEIGHT,
        duration: CLOSE_DURATION,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(sheetOpacity, {
        toValue: 0,
        duration: CLOSE_DURATION - 30,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setModalVisible(false);
    });
  }, [isChatOpen, modalVisible, backdropOpacity, sheetTranslateY, sheetOpacity]);

  const send = async () => {
    const t = input.trim();
    if (!t || sending) return;
    setInput('');
    const ok = await sendMessage(t);
    if (!ok) setInput(t);
  };

  const canSend = Boolean(input.trim()) && !sending;
  const fabBottom = Math.max(insets.bottom, 10) + NAV_CLEARANCE;

  return (
    <>
      <Modal visible={modalVisible} animationType="none" transparent onRequestClose={closeChat}>
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={insets.top}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={closeChat} accessibilityRole="button" accessibilityLabel="Close chat">
            <Animated.View
              style={[
                styles.backdrop,
                {
                  opacity: backdropOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  }),
                },
              ]}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0.14)']}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </Pressable>
          <Animated.View
            style={[
              styles.sheet,
              {
                height: SHEET_HEIGHT,
                marginBottom: fabBottom - NAV_CLEARANCE + 8,
                opacity: sheetOpacity,
                transform: [{ translateY: sheetTranslateY }],
              },
            ]}
          >
            <LinearGradient
              colors={['#F54E25', '#EA580C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sheetAccent}
            />

            <LinearGradient
              colors={['rgba(255,255,255,0.98)', 'rgba(248,250,255,0.95)']}
              style={styles.sheetHeader}
            >
              <View style={styles.sheetHeaderLeft}>
                <ChatBrandMark />
                <View style={styles.sheetHeaderText}>
                  <Text style={styles.sheetTitle}>Bridges of Hope</Text>
                  <View style={styles.statusRow}>
                    <View style={styles.statusDot} />
                    <Text style={styles.sheetSub}>Care team</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={closeChat}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close chat"
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </LinearGradient>

            <ScrollView
              ref={scrollRef}
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              {loading && messages.length <= 1 ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator color="#F54E25" />
                  <Text style={styles.loadingText}>Loading messages…</Text>
                </View>
              ) : null}

              {messages.map((msg) => {
                const isUser = msg.sender === 'user';
                if (isUser) {
                  return (
                    <View key={String(msg.id)} style={styles.rowSent}>
                      <LinearGradient
                        colors={['#F54E25', '#EA580C']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.bubble, styles.bubbleUser]}
                      >
                        <Text style={styles.bubbleTextUser}>{msg.text}</Text>
                        {msg.time ? <Text style={styles.bubbleTimeUser}>{msg.time}</Text> : null}
                      </LinearGradient>
                    </View>
                  );
                }
                return (
                  <View key={String(msg.id)} style={styles.rowReceived}>
                    <View style={[styles.bubble, styles.bubbleBot]}>
                      <Text style={styles.bubbleText}>{msg.text}</Text>
                      {msg.time ? <Text style={styles.bubbleTime}>{msg.time}</Text> : null}
                    </View>
                  </View>
                );
              })}

              {sending ? <TypingIndicator /> : null}
            </ScrollView>

            {sendError ? <Text style={styles.errorText}>{sendError}</Text> : null}

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Type your message..."
                placeholderTextColor="#94A3B8"
                value={input}
                onChangeText={setInput}
                onSubmitEditing={send}
                returnKeyType="send"
                editable={!sending}
                multiline
              />
              <TouchableOpacity
                onPress={send}
                disabled={!canSend}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Send message"
              >
                <LinearGradient
                  colors={['#F54E25', '#EA580C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
                >
                  <Ionicons name="send" size={18} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {!isChatOpen ? (
        <Animated.View style={[styles.fab, { bottom: fabBottom, transform: [{ scale: fabScale }] }]}>
          <TouchableOpacity
            style={styles.fabPressable}
            onPress={openChat}
            accessibilityRole="button"
            accessibilityLabel="Open chat support"
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#F54E25', '#EA580C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fabGradient}
            >
              <Ionicons name="chatbubble-ellipses" size={26} color="#FFFFFF" />
            </LinearGradient>
            {unreadCount > 0 ? (
              <View style={styles.fabBadge}>
                <Text style={styles.fabBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </Animated.View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      },
      default: {},
    }),
  },
  sheet: {
    marginHorizontal: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(233, 237, 247, 0.9)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 24,
  },
  sheetAccent: {
    height: 3,
    width: '100%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(241, 245, 249, 0.95)',
  },
  sheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  sheetHeaderText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  sheetSub: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(241, 245, 249, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandAvatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9EDF7',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
    overflow: 'hidden',
  },
  brandLogo: {
    width: '100%',
    height: '100%',
  },
  body: {
    flex: 1,
    backgroundColor: '#F4F7FE',
  },
  bodyContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 8,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  rowSent: {
    alignItems: 'flex-end',
  },
  rowReceived: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    paddingVertical: 11,
    paddingHorizontal: 15,
  },
  bubbleBot: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E9EDF7',
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  bubbleUser: {
    borderRadius: 18,
    borderBottomRightRadius: 6,
    shadowColor: '#F54E25',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 4,
  },
  bubbleText: {
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  bubbleTextUser: {
    fontSize: 13,
    color: '#FFFFFF',
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  bubbleTime: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: '500',
    color: '#94A3B8',
    textAlign: 'left',
  },
  bubbleTimeUser: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.82)',
    textAlign: 'right',
  },
  typingBubble: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E9EDF7',
    borderRadius: 18,
    borderBottomLeftRadius: 6,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94A3B8',
    opacity: 0.55,
  },
  typingDot1: { opacity: 0.9 },
  typingDot2: { opacity: 0.65 },
  typingDot3: { opacity: 0.4 },
  errorText: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 2,
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(241, 245, 249, 0.95)',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'ios' ? 12 : 10,
    paddingBottom: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 14,
    color: '#1B2559',
    backgroundColor: '#FFFFFF',
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F54E25',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
    elevation: 6,
  },
  sendBtnDisabled: {
    opacity: 0.42,
    shadowOpacity: 0,
    elevation: 0,
  },
  fab: {
    position: 'absolute',
    right: 16,
    width: 58,
    height: 58,
    borderRadius: 29,
    zIndex: 2100,
    elevation: 16,
    shadowColor: '#F54E25',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  fabPressable: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  fabGradient: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#DC2626',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  fabBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
});
