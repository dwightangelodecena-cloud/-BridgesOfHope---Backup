import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSupportChatMobile } from '../../lib/useSupportChatMobile';

export function FamilyFloatingChat() {
  const insets = useSafeAreaInsets();
  const [input, setInput] = React.useState('');
  const scrollRef = useRef<ScrollView>(null);
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

  useEffect(() => {
    if (!isChatOpen) return;
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages, sending, isChatOpen]);

  const send = async () => {
    const t = input.trim();
    if (!t || sending) return;
    setInput('');
    const ok = await sendMessage(t);
    if (!ok) setInput(t);
  };

  return (
    <>
      <Modal visible={isChatOpen} animationType="slide" transparent onRequestClose={() => setIsChatOpen(false)}>
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={insets.top}
        >
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setIsChatOpen(false)} />
          <View style={[styles.sheet, { marginBottom: Math.max(insets.bottom, 12) + 72 }]}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <View style={styles.sheetIcon}>
                  <Ionicons name="chatbubble-ellipses" size={20} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={styles.sheetTitle}>Care team</Text>
                  <Text style={styles.sheetSub}>Bridges of Hope support</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsChatOpen(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color="#A3AED0" />
              </TouchableOpacity>
            </View>
            <ScrollView ref={scrollRef} style={styles.body} contentContainerStyle={styles.bodyContent}>
              {loading && messages.length <= 1 ? (
                <ActivityIndicator color="#F54E25" style={{ marginVertical: 16 }} />
              ) : null}
              {messages.map((msg) => {
                const isUser = msg.sender === 'user';
                return (
                  <View
                    key={String(msg.id)}
                    style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}
                  >
                    <Text style={styles.bubbleText}>{msg.text}</Text>
                    {msg.time ? <Text style={styles.bubbleTime}>{msg.time}</Text> : null}
                  </View>
                );
              })}
              {sending ? (
                <View style={styles.typing}>
                  <ActivityIndicator size="small" color="#64748B" />
                </View>
              ) : null}
            </ScrollView>
            {sendError ? (
              <Text style={styles.errorText}>{sendError}</Text>
            ) : null}
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
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
                onPress={send}
                disabled={!input.trim() || sending}
              >
                <Ionicons name="send" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <TouchableOpacity
        style={[styles.fab, { bottom: Math.max(insets.bottom, 10) + 64 }]}
        onPress={() => setIsChatOpen(!isChatOpen)}
        accessibilityRole="button"
        accessibilityLabel={isChatOpen ? 'Close chat' : 'Open chat support'}
      >
        <Ionicons name={isChatOpen ? 'close' : 'chatbubble-ellipses'} size={26} color="#FFFFFF" />
        {!isChatOpen && unreadCount > 0 ? (
          <View style={styles.fabBadge}>
            <Text style={styles.fabBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  sheet: {
    marginHorizontal: 12,
    maxHeight: '72%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8EAEF',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F1F1',
  },
  sheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sheetIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F54E25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1B2559',
  },
  sheetSub: {
    fontSize: 11,
    color: '#707EAE',
    fontWeight: '600',
  },
  body: {
    maxHeight: 320,
    backgroundColor: '#F9F9FB',
  },
  bodyContent: {
    padding: 14,
    gap: 10,
  },
  bubble: {
    maxWidth: '88%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  bubbleBot: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EAEF',
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#FFF1EB',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  bubbleText: {
    fontSize: 14,
    color: '#1B2559',
    lineHeight: 20,
  },
  bubbleTime: {
    marginTop: 6,
    fontSize: 9,
    opacity: 0.55,
    textAlign: 'right',
  },
  typing: {
    alignSelf: 'flex-start',
    padding: 8,
  },
  errorText: {
    paddingHorizontal: 14,
    paddingTop: 6,
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F1F1',
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1B2559',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F54E25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  fab: {
    position: 'absolute',
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F54E25',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2100,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
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
