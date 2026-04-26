import React, { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Msg = { id: number; text: string; sender: 'bot' | 'user'; time: string };

export function FamilyFloatingChat() {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { id: 1, text: 'Hello! How can I help you today?', sender: 'bot', time: '3:18 PM' },
  ]);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages, typing, open]);

  const send = () => {
    const t = input.trim();
    if (!t || typing) return;
    const userMsg: Msg = {
      id: Date.now(),
      text: t,
      sender: 'user',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages((m) => [
        ...m,
        {
          id: Date.now() + 1,
          text: 'Thank you for reaching out to Bridges of Hope. How can I assist you with your recovery journey today?',
          sender: 'bot',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }, 1500);
  };

  return (
    <>
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={insets.top}
        >
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { marginBottom: Math.max(insets.bottom, 12) + 72 }]}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <View style={styles.sheetIcon}>
                  <Ionicons name="chatbubble-ellipses" size={20} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={styles.sheetTitle}>Support AI</Text>
                  <Text style={styles.sheetSub}>Active now</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color="#A3AED0" />
              </TouchableOpacity>
            </View>
            <ScrollView ref={scrollRef} style={styles.body} contentContainerStyle={styles.bodyContent}>
              {messages.map((msg) => (
                <View
                  key={msg.id}
                  style={[styles.bubble, msg.sender === 'bot' ? styles.bubbleBot : styles.bubbleUser]}
                >
                  <Text style={styles.bubbleText}>{msg.text}</Text>
                  <Text style={styles.bubbleTime}>{msg.time}</Text>
                </View>
              ))}
              {typing ? (
                <View style={styles.typing}>
                  <Text style={styles.typingText}>…</Text>
                </View>
              ) : null}
            </ScrollView>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Type your message..."
                placeholderTextColor="#94A3B8"
                value={input}
                onChangeText={setInput}
                onSubmitEditing={send}
                returnKeyType="send"
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!input.trim() || typing) && styles.sendBtnDisabled]}
                onPress={send}
                disabled={!input.trim() || typing}
              >
                <Ionicons name="send" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <TouchableOpacity
        style={[styles.fab, { bottom: Math.max(insets.bottom, 10) + 64 }]}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={open ? 'Close chat' : 'Open chat support'}
      >
        <Ionicons name={open ? 'close' : 'chatbubble-ellipses'} size={26} color="#FFFFFF" />
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
    color: '#22C55E',
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
  typingText: {
    color: '#64748B',
    fontSize: 20,
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
});
