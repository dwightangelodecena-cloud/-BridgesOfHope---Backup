import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TAB_ROUTES } from '../../lib/navigationConfig';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'support';
  timestamp: string;
  /** Support: tap bubble to show sent time */
  showTime?: boolean;
  /** User: before read receipt — only shown under the latest outgoing message */
  receipt?: 'sent' | 'delivered';
  /** User: when staff saw this message (replaces Sent/Delivered) */
  seenAt?: string;
}

export default function MessageScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  /** Ignore delayed "seen" updates if the user sent a newer message since */
  const latestPendingSeenIdRef = useRef<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hello! How can I help you today?',
      sender: 'support',
      timestamp: '3:18 PM',
      showTime: false,
    },
    {
      id: '2',
      text: "Hi! I'm having trouble accessing my account dashboard. Can you help?",
      sender: 'user',
      timestamp: '3:19 PM',
    },
    {
      id: '3',
      text: 'Thank you for your message! A member of our staff will respond to you soon. We appreciate your patience.',
      sender: 'support',
      timestamp: '3:19 PM',
      showTime: false,
    },
  ]);

  const lastUserMessageIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender === 'user') return i;
    }
    return -1;
  }, [messages]);

  const sendMessage = () => {
    if (inputText.trim().length === 0) return;

    const sentAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const messageId = `${Date.now()}`;
    const newMessage: Message = {
      id: messageId,
      text: inputText.trim(),
      sender: 'user',
      timestamp: sentAt,
      receipt: 'sent',
    };

    setMessages((prev) => {
      const cleared = prev.map((m) =>
        m.sender === 'user'
          ? { ...m, seenAt: undefined, receipt: undefined }
          : m
      );
      return [...cleared, newMessage];
    });
    setInputText('');
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    latestPendingSeenIdRef.current = messageId;

    setTimeout(() => {
      if (latestPendingSeenIdRef.current !== messageId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, receipt: 'delivered' as const } : m
        )
      );
    }, 450);

    setTimeout(() => {
      if (latestPendingSeenIdRef.current !== messageId) return;
      const seenTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, seenAt: seenTime, receipt: undefined }
            : m
        )
      );
    }, 2200);
  };

  const toggleTime = (id: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === id ? { ...msg, showTime: !msg.showTime } : msg
      )
    );
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isUser = item.sender === 'user';
    const next = messages[index + 1];
    const followedBySameSender = Boolean(next && next.sender === item.sender);
    const showUserReceiptRow =
      isUser &&
      index === lastUserMessageIndex &&
      (item.seenAt || item.receipt);

    let receiptLabel: string | null = null;
    if (showUserReceiptRow) {
      if (item.seenAt) receiptLabel = `Seen · ${item.seenAt}`;
      else if (item.receipt === 'sent') receiptLabel = 'Sent';
      else if (item.receipt === 'delivered') receiptLabel = 'Delivered';
    }

    return (
      <View
        style={[
          styles.messageWrapper,
          isUser ? styles.userWrapper : styles.supportWrapper,
          followedBySameSender ? styles.stackTight : styles.stackLoose,
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => !isUser && toggleTime(item.id)}
          style={[styles.messageBubble, isUser ? styles.userBubble : styles.supportBubble]}
        >
          <Text style={[styles.messageText, isUser ? styles.userText : styles.supportText]}>
            {item.text}
          </Text>
        </TouchableOpacity>
        {receiptLabel ? (
          <Text style={[styles.userReceipt, styles.userTimestamp]}>{receiptLabel}</Text>
        ) : null}
        {!isUser && item.showTime ? (
          <Text style={[styles.timestamp, styles.supportTimestamp]}>{item.timestamp}</Text>
        ) : null}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.avatar}>
            <Ionicons name="business" size={20} color="#FFF" />
            <View style={styles.onlineStatus} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Bridges of Hope Imus</Text>
            <Text style={styles.headerSubtitle}>Active now</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="call-outline" size={24} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="ellipsis-vertical" size={24} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => renderMessage({ item, index })}
        contentContainerStyle={styles.chatList}
        showsVerticalScrollIndicator={false}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <View style={styles.inputAreaWrapper}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Hello!"
              value={inputText}
              onChangeText={setInputText}
              multiline
            />
            <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
              <Ionicons name="send" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 15) }]}>
        <TabItem
          img={require('../../assets/images/home-icon.png')}
          label="Home"
          onPress={() => router.navigate(TAB_ROUTES.home)}
        />
        <TabItem
          img={require('../../assets/images/progress-icon.png')}
          label="Progress"
          onPress={() => router.navigate(TAB_ROUTES.progress)}
        />
        <TabItem
          img={require('../../assets/images/messages-icon.png')}
          label="Message"
          active
          onPress={() => {}} 
        />
        <TabItem
          img={require('../../assets/images/profile-icon.png')}
          label="Profile"
          onPress={() => router.navigate(TAB_ROUTES.profile)}
        />
      </View>
    </View>
  );
}

const TabItem = ({ img, label, active, onPress }: any) => (
  <TouchableOpacity style={styles.tabItem} onPress={onPress}>
    <Image
      source={img}
      style={[styles.tabIcon, { tintColor: active ? "#F54E25" : "#999999" }]}
      resizeMode="contain"
    />
    <Text style={[styles.tabLabel, active && styles.activeTabLabel]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderColor: '#EEE',
  },
  backButton: {
    marginRight: 10,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2B6BFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  onlineStatus: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#999',
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerIcon: {
    marginLeft: 15,
  },
  chatList: {
    padding: 20,
  },
  messageWrapper: {
    maxWidth: '85%',
  },
  stackTight: {
    marginBottom: 3,
  },
  stackLoose: {
    marginBottom: 18,
  },
  userWrapper: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  supportWrapper: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  messageBubble: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 25,
  },
  userBubble: {
    backgroundColor: '#F54E25',
    borderBottomRightRadius: 5,
  },
  supportBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  messageText: {
    fontSize: 15,
  },
  userText: {
    color: '#FFFFFF',
  },
  supportText: {
    color: '#333333',
  },
  timestamp: {
    fontSize: 11,
    color: '#999',
    marginTop: 5,
  },
  userReceipt: {
    fontSize: 11,
    color: '#333',
    marginTop: 3,
    fontWeight: '500',
  },
  userTimestamp: {
    marginRight: 5,
  },
  supportTimestamp: {
    marginLeft: 5,
  },
  inputAreaWrapper: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#F0F0F0',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#F2F3F5',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginRight: 10,
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#F54E25',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
    paddingTop: 10,
  },
  tabItem: {
    alignItems: 'center',
    flex: 1,
  },
  tabIcon: {
    width: 24,
    height: 24,
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 12,
    color: '#999999',
  },
  activeTabLabel: {
    color: '#F54E25',
    fontWeight: '600',
  },
});