import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  Modal,
  Pressable,
  Dimensions,
  ActivityIndicator,
  Keyboard,
  Platform,
  ScrollView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { TAB_ROUTES } from '../../lib/navigationConfig';
import { FamilyWebMobileNav } from '../../components/family/FamilyWebMobileNav';
import { notificationTextMobile } from '../../lib/familyNotificationsMobile';
import { useFamilyNotificationsState } from '../../lib/useFamilyNotificationsMobile';
import { useFamilyUserMobile } from '../../lib/useFamilyUserMobile';
import { useSupportChatMobile } from '../../lib/useSupportChatMobile';
import { supportWelcomeMessage, type SupportUiMessage } from '../../lib/supportMessagingMobile';
import { FamilyMobilePageHeader } from '../../components/family/FamilyMobilePageHeader';
import { useFamilyPageScroll } from '../../lib/useFamilyPageScroll';

const { width } = Dimensions.get('window');

const SUPPORT_THREAD_ID = 'support';

/**
 * Messenger-style: auto-follow only when this close to the content bottom.
 * RN FlatList `onScroll` uses contentOffset/contentSize/layoutMeasurement; on web/DOM the
 * equivalent is: distanceFromBottom = scrollHeight - scrollTop - clientHeight ≤ threshold.
 */
const AUTO_SCROLL_BOTTOM_THRESHOLD_PX = 100;

/** Breathing room below last bubble (input sits outside the list in flex layout). */
const CHAT_LIST_FOOTER_GAP_PX = 12;

function deriveInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => (p[0] ? p[0].toUpperCase() : '')).join('') || 'FU';
}

function SupportBrandAvatar({ size = 32 }: { size?: number }) {
  const badge = size;
  const radius = Math.round(badge * 0.28);
  const pad = Math.max(4, Math.round(badge * 0.12));
  return (
    <View
      style={[
        styles.supportBrandBadge,
        { width: badge, height: badge, borderRadius: radius, padding: pad },
      ]}
    >
      <Image
        source={require('../../assets/images/BRIDGESOFHOPELOGO.png')}
        style={styles.supportBrandLogo}
        resizeMode="contain"
        accessibilityLabel="Bridges of Hope"
      />
    </View>
  );
}

function ChatWelcomeBanner() {
  return (
    <View style={styles.chatWelcomeBanner}>
      <LinearGradient colors={['#FFF7ED', '#FFEDD5']} style={styles.chatWelcomeIcon}>
        <Ionicons name="chatbubble-ellipses-outline" size={18} color="#EA580C" />
      </LinearGradient>
      <View style={styles.chatWelcomeCopy}>
        <Text style={styles.chatWelcomeTitle}>You’re connected to the care team</Text>
        <Text style={styles.chatWelcomeSub}>
          Ask about visits, updates, or billing. We typically reply during business hours.
        </Text>
      </View>
    </View>
  );
}

/** Centered row label, e.g. "Sat 11:22 PM" */
function formatDateSeparatorLabel(ms: number): string {
  const d = new Date(ms);
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${weekday} ${time}`;
}

/** Compact relative time for bubbles & inbox (updates with `now`). */
function formatRelativeShort(now: number, then: number): string {
  const diff = Math.max(0, now - then);
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(then).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatMessageTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const AVATAR_HEAD = 32;
const AVATAR_GAP = 8;

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'support';
  /** Canonical time for sorting, separators, and live relative labels */
  createdAtMs: number;
  /** @deprecated prefer createdAtMs + formatters */
  timestamp?: string;
  showTime?: boolean;
  receipt?: 'sent' | 'delivered';
  seenAt?: string;
}

type ChatRow =
  | { type: 'separator'; id: string; label: string }
  | { type: 'message'; message: Message; index: number };

function buildChatRows(messages: Message[]): ChatRow[] {
  const rows: ChatRow[] = [];
  let prevMs: number | null = null;
  messages.forEach((m, index) => {
    const needSep =
      index === 0 ||
      (prevMs != null && new Date(m.createdAtMs).toDateString() !== new Date(prevMs).toDateString()) ||
      (prevMs != null && m.createdAtMs - prevMs > 60 * 60 * 1000);
    if (needSep) {
      rows.push({ type: 'separator', id: `sep-${m.id}`, label: formatDateSeparatorLabel(m.createdAtMs) });
    }
    rows.push({ type: 'message', message: m, index });
    prevMs = m.createdAtMs;
  });
  return rows;
}

function supportUiToMessage(row: SupportUiMessage): Message {
  const ms = row.createdAt ? new Date(row.createdAt).getTime() : Date.now();
  return {
    id: String(row.id),
    text: row.text,
    sender: row.sender === 'user' ? 'user' : 'support',
    createdAtMs: Number.isFinite(ms) ? ms : Date.now(),
    showTime: false,
  };
}

function supportRowsToMessages(rows: SupportUiMessage[]): Message[] {
  const list = rows.filter((m) => m.id !== 'welcome').map(supportUiToMessage);
  if (!list.length) return [supportUiToMessage(supportWelcomeMessage())];
  return list;
}

type ThreadRow = { id: string; kind: 'support'; title: string; subtitle: string };

export default function MessageScreen() {
  const insets = useSafeAreaInsets();
  const { scrollRef, scrollToTop } = useFamilyPageScroll();
  const router = useRouter();
  const [inputText, setInputText] = useState('');
  /** Scroll container (FlatList). */
  const flatListRef = useRef<FlatList>(null);
  const flatListViewportHRef = useRef(0);
  /** Web: DOM node at end of thread for scrollIntoView / scrollHeight sync; native: list footer anchor. */
  const bottomAnchorRef = useRef<View>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  type InboxFilterTab = 'all' | 'unread';
  const [inboxFilterTab, setInboxFilterTab] = useState<InboxFilterTab>('all');
  const [showInboxOverflowMenu, setShowInboxOverflowMenu] = useState(false);
  const [inboxSelectionMode, setInboxSelectionMode] = useState(false);
  const [selectedThreadIds, setSelectedThreadIds] = useState<Record<string, boolean>>({});
  const [unreadByThread, setUnreadByThread] = useState<Record<string, boolean>>({});
  const [archivedByThread, setArchivedByThread] = useState<Record<string, boolean>>({});
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);
  const [deletedByThread, setDeletedByThread] = useState<Record<string, boolean>>({});
  const [showNotifications, setShowNotifications] = useState(false);
  const { userId: familyUserId, displayName, initials: userInitials } = useFamilyUserMobile();
  const { notificationItems, setNotificationItems } = useFamilyNotificationsState(familyUserId);
  const {
    messages: supportChatMessages,
    unreadCount: supportUnreadCount,
    reload: reloadSupportChat,
    sendMessage: sendSupportMessage,
    refreshUnread: refreshSupportUnread,
    markSupportAsRead,
  } = useSupportChatMobile();
  const [messagesByThread, setMessagesByThread] = useState<Record<string, Message[]>>({});
  const [supportSendError, setSupportSendError] = useState('');
  const [supportSending, setSupportSending] = useState(false);
  /** Re-render relative times (~every 30s while chatting). */
  const [nowTick, setNowTick] = useState(() => Date.now());
  const bottomInsetPad = Math.max(insets.bottom, 8);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  /** Push composer above keyboard (KAV is unreliable with tabs / Android edge-to-edge). */
  const [keyboardBottomInset, setKeyboardBottomInset] = useState(0);
  /** True when the viewport is within AUTO_SCROLL_BOTTOM_THRESHOLD_PX of the list bottom. */
  const nearBottomRef = useRef(true);
  /** True briefly after Send so layout can scroll even if keyboard-hide suppress is active. */
  const pendingUserSendRef = useRef(false);
  const pendingScrollClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** After keyboard hides, skip layout-only scroll nudges so the viewport does not jump. */
  const suppressLayoutAutoScrollRef = useRef(false);
  const suppressLayoutAutoScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const durationOf = (e: { duration?: number }) =>
      Platform.OS === 'ios' ? e.duration ?? 250 : Math.min(e.duration ?? 200, 280);

    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const subShow = Keyboard.addListener(showEvt, (e) => {
      setKeyboardOpen(true);
      setKeyboardBottomInset(e.endCoordinates.height);
    });
    const subHide = Keyboard.addListener(hideEvt, (e) => {
      suppressLayoutAutoScrollRef.current = true;
      if (suppressLayoutAutoScrollTimerRef.current) clearTimeout(suppressLayoutAutoScrollTimerRef.current);
      suppressLayoutAutoScrollTimerRef.current = setTimeout(() => {
        suppressLayoutAutoScrollRef.current = false;
        suppressLayoutAutoScrollTimerRef.current = null;
      }, Math.max(durationOf(e), 320));
      setKeyboardOpen(false);
      setKeyboardBottomInset(0);
    });
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reloadSupportChat({ silent: true });
    }, [reloadSupportChat])
  );

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setMessagesByThread((prev) => ({
      ...prev,
      [SUPPORT_THREAD_ID]: supportRowsToMessages(supportChatMessages),
    }));
  }, [supportChatMessages]);

  useEffect(() => {
    setUnreadByThread((prev) => {
      const next = { ...prev };
      if (supportUnreadCount > 0) next[SUPPORT_THREAD_ID] = true;
      else delete next[SUPPORT_THREAD_ID];
      return next;
    });
  }, [supportUnreadCount]);

  const threadRows: ThreadRow[] = useMemo(() => {
    const supportMsgs = messagesByThread[SUPPORT_THREAD_ID] ?? [];
    const lastS = supportMsgs[supportMsgs.length - 1];
    const supportPreview = lastS
      ? `${lastS.text.slice(0, 42)}${lastS.text.length > 42 ? '…' : ''} · ${formatRelativeShort(nowTick, lastS.createdAtMs)}`
      : 'Care team · General questions';

    const support: ThreadRow = {
      id: SUPPORT_THREAD_ID,
      kind: 'support',
      title: 'Bridges of Hope',
      subtitle: supportPreview,
    };
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [support];
    return [support.title, support.subtitle].some((part) => part.toLowerCase().includes(q))
      ? [support]
      : [];
  }, [searchQuery, messagesByThread, nowTick]);

  const filteredInboxThreadRows = useMemo(() => {
    let rows = threadRows.filter((r) => !deletedByThread[r.id]);
    if (showArchivedOnly) {
      rows = rows.filter((r) => archivedByThread[r.id]);
    } else {
      rows = rows.filter((r) => !archivedByThread[r.id]);
    }
    if (inboxFilterTab === 'unread') {
      rows = rows.filter((r) => unreadByThread[r.id]);
    }
    return rows;
  }, [
    threadRows,
    deletedByThread,
    showArchivedOnly,
    archivedByThread,
    inboxFilterTab,
    unreadByThread,
  ]);

  const exitInboxSelectionMode = useCallback(() => {
    setInboxSelectionMode(false);
    setSelectedThreadIds({});
  }, []);

  const toggleThreadSelected = useCallback((threadId: string) => {
    setSelectedThreadIds((prev) => {
      const next = { ...prev };
      if (next[threadId]) delete next[threadId];
      else next[threadId] = true;
      return next;
    });
  }, []);

  const selectedInboxIds = useMemo(
    () => Object.keys(selectedThreadIds).filter((k) => selectedThreadIds[k]),
    [selectedThreadIds],
  );

  const messages = activeThreadId ? messagesByThread[activeThreadId] ?? [] : [];

  const chatRows: ChatRow[] = useMemo(() => buildChatRows(messages), [messages]);

  const lastUserMessageIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender === 'user') return i;
    }
    return -1;
  }, [messages]);

  const activeThreadTitle = 'Bridges of Hope';

  /**
   * Messenger-style: move viewport to latest message.
   * Web: scrollIntoView on bottom anchor (overflow scroll container).
   * iOS/Android: FlatList.scrollToEnd (no DOM scrollIntoView).
   */
  const scrollBottomAnchorIntoView = useCallback((animated: boolean) => {
    if (Platform.OS === 'web') {
      const el = bottomAnchorRef.current as unknown as HTMLElement | undefined;
      const run = () =>
        el?.scrollIntoView?.({ block: 'end', behavior: animated ? 'smooth' : 'auto' });
      run();
      requestAnimationFrame(run);
      setTimeout(run, 40);
      setTimeout(run, 120);
      return;
    }
    // Always non-animated on native: animated scrollToEnd can glitch during re-layout and jump to top.
    const go = () => flatListRef.current?.scrollToEnd({ animated: false });
    go();
    requestAnimationFrame(go);
    requestAnimationFrame(() => requestAnimationFrame(go));
    setTimeout(go, 40);
    setTimeout(go, 120);
    setTimeout(go, 280);
    setTimeout(go, 450);
    setTimeout(go, 650);
    setTimeout(go, 900);
  }, []);

  type ScrollToBottomOpts = { bypassLayoutSuppress?: boolean; ignoreNearBottom?: boolean };

  /**
   * Scroll to latest. Unless `ignoreNearBottom`, only runs when the user is in the bottom band
   * (or just tapped Send via `pendingUserSendRef`).
   */
  const scrollChatToBottom = useCallback(
    (animated: boolean, opts: ScrollToBottomOpts = {}) => {
      const bypassLayoutSuppress = opts.bypassLayoutSuppress ?? false;
      const ignoreNearBottom = opts.ignoreNearBottom ?? false;

      if (
        !bypassLayoutSuppress &&
        suppressLayoutAutoScrollRef.current &&
        !pendingUserSendRef.current
      ) {
        return;
      }
      if (
        !ignoreNearBottom &&
        !nearBottomRef.current &&
        !pendingUserSendRef.current
      ) {
        return;
      }
      scrollBottomAnchorIntoView(animated);
    },
    [scrollBottomAnchorIntoView]
  );

  const updateNearBottomFromScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    // Same as DOM: scrollTop ≈ contentOffset.y, clientHeight ≈ layoutMeasurement.height,
    // scrollHeight ≈ contentSize.height → distance from bottom = scrollHeight - scrollTop - clientHeight
    const scrollTop = contentOffset.y;
    const clientHeight = layoutMeasurement.height;
    const scrollHeight = contentSize.height;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const fitsOnScreen = scrollHeight <= clientHeight + 4;
    const nearBottom =
      fitsOnScreen || distanceFromBottom <= AUTO_SCROLL_BOTTOM_THRESHOLD_PX;
    nearBottomRef.current = nearBottom;
    if (!nearBottom) pendingUserSendRef.current = false;
  }, []);

  /**
   * Stable list content style: flexGrow + flex-end pins short threads to the bottom of the
   * scroll area (Messenger). Same array identity avoids FlatList scroll reset on iOS.
   */
  const chatListContentStyle = useMemo(
    () => [styles.chatList, styles.chatListContent],
    []
  );

  const chatListHeaderEl = useMemo(() => {
    if (activeThreadId !== SUPPORT_THREAD_ID) return null;
    return <ChatWelcomeBanner />;
  }, [activeThreadId]);

  const chatListFooterEl = useMemo(
    () => (
      <View collapsable={false} pointerEvents="none">
        <View style={{ height: CHAT_LIST_FOOTER_GAP_PX }} />
        <View
          ref={bottomAnchorRef}
          collapsable={false}
          style={styles.chatBottomAnchor}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </View>
    ),
    []
  );

  useEffect(() => {
    if (!activeThreadId) {
      pendingUserSendRef.current = false;
      return;
    }
    pendingUserSendRef.current = false;
    nearBottomRef.current = true;
    const t = setTimeout(() =>
      scrollChatToBottom(false, { bypassLayoutSuppress: true, ignoreNearBottom: true })
    , 80);
    return () => clearTimeout(t);
  }, [activeThreadId, scrollChatToBottom]);

  /** Keyboard opens / inset grows: nudge only if already in the bottom band. */
  useEffect(() => {
    if (!activeThreadId || !keyboardOpen) return;
    scrollChatToBottom(false, { bypassLayoutSuppress: true });
    const a = setTimeout(() => scrollChatToBottom(false, { bypassLayoutSuppress: true }), 60);
    const b = setTimeout(() => scrollChatToBottom(true, { bypassLayoutSuppress: true }), 180);
    const c = setTimeout(() => scrollChatToBottom(false, { bypassLayoutSuppress: true }), 420);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
      clearTimeout(c);
    };
  }, [keyboardOpen, activeThreadId, scrollChatToBottom]);

  useEffect(() => {
    return () => {
      if (pendingScrollClearTimerRef.current) clearTimeout(pendingScrollClearTimerRef.current);
      if (suppressLayoutAutoScrollTimerRef.current) clearTimeout(suppressLayoutAutoScrollTimerRef.current);
    };
  }, []);

  /**
   * New/changed messages → scrollIntoView / scrollToEnd only when `nearBottomRef` is true
   * (or a send just happened via `pendingUserSendRef`). Preserves position when scrolled up.
   */
  useEffect(() => {
    if (!activeThreadId) return;
    scrollChatToBottom(false, { bypassLayoutSuppress: true });
    requestAnimationFrame(() => scrollChatToBottom(false, { bypassLayoutSuppress: true }));
  }, [messages, activeThreadId, scrollChatToBottom]);

  const openThread = (id: string) => {
    if (id !== SUPPORT_THREAD_ID) return;
    setUnreadByThread((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setActiveThreadId(id);
    if (id === SUPPORT_THREAD_ID) {
      setSupportSendError('');
      void markSupportAsRead();
    }
    setMessagesByThread((prev) => {
      if (prev[SUPPORT_THREAD_ID]?.length) return prev;
      return {
        ...prev,
        [SUPPORT_THREAD_ID]: [supportUiToMessage(supportWelcomeMessage())],
      };
    });
    nearBottomRef.current = true;
    setTimeout(
      () => scrollChatToBottom(false, { bypassLayoutSuppress: true, ignoreNearBottom: true }),
      100
    );
  };

  const sendMessage = async () => {
    if (!activeThreadId || inputText.trim().length === 0) return;

    const text = inputText.trim();

    if (activeThreadId === SUPPORT_THREAD_ID) {
      if (!familyUserId || supportSending) return;
      setSupportSendError('');
      setSupportSending(true);
      setInputText('');
      pendingUserSendRef.current = true;
      nearBottomRef.current = true;
      scrollChatToBottom(false, { bypassLayoutSuppress: true, ignoreNearBottom: true });

      const ok = await sendSupportMessage(text);
      setSupportSending(false);
      if (!ok) {
        setSupportSendError('Could not send message. Check your connection and try again.');
        setInputText(text);
      }
      return;
    }
  };

  const toggleTime = (id: string) => {
    if (!activeThreadId) return;
    setMessagesByThread((prev) => ({
      ...prev,
      [activeThreadId]: (prev[activeThreadId] ?? []).map((msg) =>
        msg.id === id ? { ...msg, showTime: !msg.showTime } : msg
      ),
    }));
  };

  const renderChatRow = ({ item }: { item: ChatRow }) => {
    if (item.type === 'separator') {
      return (
        <View style={styles.dateSeparatorWrap}>
          <Text style={styles.dateSeparatorText}>{item.label}</Text>
        </View>
      );
    }

    const msg = item.message;
    const index = item.index;
    const isUser = msg.sender === 'user';
    const next = messages[index + 1];
    const prev = messages[index - 1];
    const followedBySameSender = Boolean(next && next.sender === msg.sender);
    const showUserReceiptRow =
      isUser && index === lastUserMessageIndex && (msg.seenAt || msg.receipt);

    /** Sender (support) only: avatar on the last message in a consecutive run. No avatar on outgoing. */
    const showSupportHead = !isUser && (!next || next.sender !== 'support');

    let receiptLabel: string | null = null;
    if (showUserReceiptRow) {
      if (msg.seenAt) receiptLabel = `Seen · ${msg.seenAt}`;
      else if (msg.receipt === 'sent') receiptLabel = 'Sent';
      else if (msg.receipt === 'delivered') receiptLabel = 'Delivered';
    }

    const headSpacerW = AVATAR_HEAD + AVATAR_GAP;

    const bubble = (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => toggleTime(msg.id)}
        style={[styles.messageBubble, isUser ? styles.userBubble : styles.supportBubble]}
      >
        {isUser ? (
          <LinearGradient
            colors={['#FF6A3D', '#F54E25', '#E8441A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <Text style={[styles.messageText, isUser ? styles.userText : styles.supportText]}>{msg.text}</Text>
      </TouchableOpacity>
    );

    const metaBlock = (
      <View
        style={[
          styles.messageMetaBlock,
          isUser ? styles.messageMetaBlockUser : styles.messageMetaBlockSupport,
          { marginLeft: isUser ? 0 : headSpacerW },
        ]}
      >
        {msg.showTime ? (
          <Text
            style={[
              styles.timestamp,
              isUser ? styles.userExpandedTime : styles.supportTimestamp,
            ]}
          >
            {formatMessageTime(msg.createdAtMs)}
          </Text>
        ) : null}
        {receiptLabel ? <Text style={[styles.userReceipt, styles.userTimestamp]}>{receiptLabel}</Text> : null}
      </View>
    );

    const supportHead = showSupportHead ? (
      <View style={[styles.bubbleHeadWrap, { marginRight: AVATAR_GAP }]}>
        <SupportBrandAvatar size={AVATAR_HEAD} />
      </View>
    ) : (
      <View style={{ width: headSpacerW }} />
    );

    return (
      <View
        style={[followedBySameSender ? styles.stackTight : styles.stackLoose, styles.messageBlock]}
      >
        {!isUser ? (
          <>
            <View style={styles.messageRowSupport}>
              {supportHead}
              <View style={[styles.bubbleColumn, styles.bubbleColumnSupport]}>{bubble}</View>
            </View>
            {metaBlock}
          </>
        ) : (
          <>
            <View style={styles.messageRowUser}>
              <View style={[styles.bubbleColumn, styles.bubbleColumnUser]}>{bubble}</View>
            </View>
            {metaBlock}
          </>
        )}
      </View>
    );
  };

  const onInboxRowPress = (id: string) => {
    if (inboxSelectionMode) {
      toggleThreadSelected(id);
      return;
    }
    openThread(id);
  };

  const onMarkSelectedUnread = () => {
    if (selectedInboxIds.length === 0) return;
    setUnreadByThread((prev) => {
      const next = { ...prev };
      for (const id of selectedInboxIds) next[id] = true;
      return next;
    });
  };

  const onArchiveSelected = () => {
    if (selectedInboxIds.length === 0) return;
    setArchivedByThread((prev) => {
      const next = { ...prev };
      for (const id of selectedInboxIds) next[id] = true;
      return next;
    });
    exitInboxSelectionMode();
  };

  const onDeleteSelected = () => {
    if (selectedInboxIds.length === 0) return;
    setDeletedByThread((prev) => {
      const next = { ...prev };
      for (const id of selectedInboxIds) next[id] = true;
      return next;
    });
    setArchivedByThread((prev) => {
      const next = { ...prev };
      for (const id of selectedInboxIds) delete next[id];
      return next;
    });
    exitInboxSelectionMode();
  };

  const renderThreadRow = ({ item }: { item: ThreadRow }) => {
    const selected = !!selectedThreadIds[item.id];
    const unread = !!unreadByThread[item.id];

    return (
      <TouchableOpacity
        style={[styles.threadRow, selected && styles.threadRowSelected]}
        onPress={() => onInboxRowPress(item.id)}
        activeOpacity={0.9}
      >
        {inboxSelectionMode ? (
          <View style={styles.threadSelectCol}>
            <View
              style={[
                styles.threadSelectCircle,
                selected ? styles.threadSelectCircleOn : null,
              ]}
            >
              {selected ? (
                <Ionicons name="checkmark" size={15} color="#FFFFFF" />
              ) : null}
            </View>
          </View>
        ) : null}
        <View style={styles.threadAvatarWrap}>
          <SupportBrandAvatar size={40} />
        </View>
        <View style={styles.threadBody}>
          <View style={styles.threadTitleRow}>
            <Text style={styles.threadTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {unread && !inboxSelectionMode ? <View style={styles.threadUnreadDot} /> : null}
          </View>
          <Text style={styles.threadSubtitle} numberOfLines={1}>
            {item.subtitle}
          </Text>
        </View>
        {inboxSelectionMode ? null : (
          <View style={styles.threadChevronWrap}>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const bottomTabBarHeight = 56 + Math.max(insets.bottom, 10);
  const inboxSelectionBarBottom = bottomTabBarHeight;
  const threadListBottomPad =
    100 + (inboxSelectionMode ? 52 : 0) + (showArchivedOnly ? 36 : 0);

  const inboxEmptyLabel = useMemo(() => {
    if (showArchivedOnly) return 'No archived chats.';
    if (inboxFilterTab === 'unread') return 'No unread chats.';
    if (searchQuery.trim()) return 'No conversations match your search.';
    return 'No conversations yet.';
  }, [showArchivedOnly, inboxFilterTab, searchQuery]);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <Modal
        visible={showInboxOverflowMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInboxOverflowMenu(false)}
      >
        <View style={styles.notifModalRoot}>
          <Pressable
            style={styles.notifModalBackdrop}
            onPress={() => setShowInboxOverflowMenu(false)}
          />
          <View style={[styles.inboxOverflowMenu, { top: insets.top + 118, right: 16 }]}>
            <TouchableOpacity
              style={styles.inboxOverflowMenuRow}
              onPress={() => {
                setShowInboxOverflowMenu(false);
                setInboxSelectionMode(true);
                setSelectedThreadIds({});
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.inboxOverflowMenuText}>Select chats</Text>
              <Ionicons name="checkmark-circle" size={20} color="#F54E25" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.inboxOverflowMenuRow}
              onPress={() => {
                setShowInboxOverflowMenu(false);
                setShowArchivedOnly(true);
                setInboxFilterTab('all');
                exitInboxSelectionMode();
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.inboxOverflowMenuText}>Archives</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showNotifications}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotifications(false)}
      >
        <View style={styles.notifModalRoot}>
          <Pressable style={styles.notifModalBackdrop} onPress={() => setShowNotifications(false)} />
          <View style={[styles.notificationsDropdown, { top: insets.top + 52, right: 16 }]}>
            <View style={styles.notificationsDropdownTitleRow}>
              <Ionicons name="notifications" size={16} color="#F54E25" />
              <Text style={styles.notificationsDropdownTitle}>Notifications</Text>
            </View>
            {notificationItems.length === 0 ? (
              <Text style={[styles.notificationsDropdownText, { color: '#94A3B8', fontWeight: '700' }]}>
                No notifications.
              </Text>
            ) : (
              notificationItems.map((notif, idx) => (
                <View key={`${notif.id}-${idx}`} style={styles.notificationsDropdownRow}>
                  <Ionicons name="checkmark-circle" size={15} color="#6366F1" />
                  <Text style={styles.notificationsDropdownText}>{notificationTextMobile(notif)}</Text>
                  <TouchableOpacity
                    onPress={() => setNotificationItems((prev) => prev.filter((r) => r.id !== notif.id))}
                    accessibilityRole="button"
                    accessibilityLabel="Remove notification"
                  >
                    <Text style={styles.notificationDismiss}>×</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>
      </Modal>

      {!activeThreadId ? (
        <>
          {inboxSelectionMode ? (
            <View style={[styles.selectionHeader, { paddingTop: insets.top + 8 }]}>
              <TouchableOpacity
                onPress={exitInboxSelectionMode}
                hitSlop={12}
                style={styles.headerCancelBtn}
                accessibilityLabel="Cancel selection"
              >
                <Text style={styles.headerCancelText}>Cancel</Text>
              </TouchableOpacity>
              <View style={styles.selectionHeaderCenter}>
                <Text style={styles.selectionHeaderTitle}>Select chats</Text>
                {selectedInboxIds.length > 0 ? (
                  <Text style={styles.selectionHeaderSub}>{selectedInboxIds.length} selected</Text>
                ) : null}
              </View>
              <View style={styles.headerEndSpacer} />
            </View>
          ) : (
            <>
              <FamilyMobilePageHeader title="Messages" onBrandPress={scrollToTop} />
              <View style={styles.inboxHero}>
                <LinearGradient
                  colors={['#0B1528', '#152238', '#2A1A28']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.inboxHeroWash} />
                <View style={styles.inboxHeroInner}>
                  <LinearGradient colors={['#FF6A3D', '#F54E25', '#E8441A']} style={styles.inboxHeroIcon}>
                    <Ionicons name="chatbubbles-outline" size={22} color="#fff" />
                  </LinearGradient>
                  <View style={styles.inboxHeroCopy}>
                    <Text style={styles.inboxHeroEyebrow}>FAMILY PORTAL</Text>
                    <Text style={styles.inboxHeroTitle}>Care conversations</Text>
                    <Text style={styles.inboxHeroSub}>Message the care team or follow up about a resident</Text>
                  </View>
                </View>
              </View>
            </>
          )}

          <View style={styles.inboxBody}>
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={18} color="#64748B" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search care team messages…"
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {showArchivedOnly ? (
              <View style={styles.archivesBanner}>
                <Text style={styles.archivesBannerText}>Archives</Text>
                <TouchableOpacity
                  onPress={() => setShowArchivedOnly(false)}
                  hitSlop={10}
                  accessibilityLabel="Back to inbox"
                >
                  <Ionicons name="close-circle" size={22} color="#64748B" />
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.inboxFilterRow}>
              <ScrollView
                horizontal
                style={styles.inboxFilterScroll}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.inboxFilterPills}
              >
                {(['all', 'unread'] as const).map((tab) => {
                  const active = inboxFilterTab === tab;
                  const label = tab === 'all' ? 'All' : 'Unread';
                  return (
                    <TouchableOpacity
                      key={tab}
                      style={[styles.inboxFilterPill, active ? styles.inboxFilterPillActive : null]}
                      onPress={() => setInboxFilterTab(tab)}
                      activeOpacity={0.85}
                      disabled={inboxSelectionMode}
                    >
                      <Text
                        style={[
                          styles.inboxFilterPillText,
                          active ? styles.inboxFilterPillTextActive : null,
                          inboxSelectionMode ? styles.inboxFilterPillTextDisabled : null,
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              {inboxSelectionMode ? (
                <View style={styles.inboxOverflowBtnPlaceholder} />
              ) : (
                <TouchableOpacity
                  style={styles.inboxOverflowBtn}
                  onPress={() => setShowInboxOverflowMenu(true)}
                  accessibilityLabel="More inbox options"
                >
                  <Ionicons name="ellipsis-horizontal" size={20} color="#475569" />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={filteredInboxThreadRows}
              keyExtractor={(row) => row.id}
              renderItem={renderThreadRow}
              style={styles.threadListFlex}
              contentContainerStyle={[
                styles.threadList,
                { paddingBottom: threadListBottomPad },
              ]}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                showArchivedOnly || inboxSelectionMode ? null : (
                  <Text style={styles.inboxHint}>Message the Bridges of Hope care team</Text>
                )
              }
              ListEmptyComponent={
                <Text style={styles.inboxEmptyText}>{inboxEmptyLabel}</Text>
              }
            />
            {inboxSelectionMode ? (
              <View
                style={[styles.inboxSelectionBar, { bottom: inboxSelectionBarBottom }]}
              >
                <TouchableOpacity onPress={onMarkSelectedUnread} hitSlop={8}>
                  <Text style={styles.inboxSelectionBarAction}>Mark unread</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onArchiveSelected} hitSlop={8}>
                  <Text style={styles.inboxSelectionBarAction}>Archive</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onDeleteSelected} hitSlop={8}>
                  <Text style={styles.inboxSelectionBarDelete}>Delete</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </>
      ) : (
        <View style={[styles.chatRoot, { paddingTop: insets.top }]}>
          <View style={styles.chatHeader}>
            <LinearGradient
              colors={['#FFFFFF', '#FFF9F6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.chatHeaderAccent} />
            <TouchableOpacity
              style={styles.chatBackBtn}
              onPress={() => setActiveThreadId(null)}
              hitSlop={12}
              accessibilityLabel="Back to inbox"
            >
              <Ionicons name="arrow-back" size={22} color="#1A2B4A" />
            </TouchableOpacity>
            <View style={styles.chatHeaderInfo}>
              <View style={styles.chatHeaderAvatarWrap}>
                <SupportBrandAvatar size={36} />
              </View>
              <View style={styles.chatHeaderTextCol}>
                <Text style={styles.chatHeaderTitle} numberOfLines={1}>
                  {activeThreadTitle}
                </Text>
                <View style={styles.chatHeaderStatusRow}>
                  <View style={styles.chatHeaderStatusDot} />
                  <Text style={styles.chatHeaderSubtitle} numberOfLines={1}>
                    Care team · Available during business hours
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.chatHeaderSpacer} />
          </View>

          <View style={[styles.chatKav, { paddingBottom: keyboardBottomInset }]}>
            <FlatList
              ref={flatListRef}
              style={[styles.chatMessagesFlex, Platform.OS === 'web' && styles.chatMessagesWeb]}
              data={chatRows}
              keyExtractor={(row) => (row.type === 'separator' ? row.id : row.message.id)}
              renderItem={renderChatRow}
              ListHeaderComponent={chatListHeaderEl}
              ListFooterComponent={chatListFooterEl}
              contentContainerStyle={chatListContentStyle}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              removeClippedSubviews={false}
              scrollEventThrottle={16}
              onLayout={(e) => {
                flatListViewportHRef.current = e.nativeEvent.layout.height;
              }}
              onScroll={updateNearBottomFromScroll}
              onMomentumScrollEnd={updateNearBottomFromScroll}
              onContentSizeChange={(_w, h) => {
                const vh = flatListViewportHRef.current;
                if (vh > 0 && h <= vh + 48) {
                  scrollChatToBottom(false, {
                    bypassLayoutSuppress: true,
                    ignoreNearBottom: true,
                  });
                }
                const bypass =
                  pendingUserSendRef.current || !suppressLayoutAutoScrollRef.current;
                scrollChatToBottom(false, { bypassLayoutSuppress: bypass });
                if (!pendingUserSendRef.current) return;
                if (pendingScrollClearTimerRef.current) clearTimeout(pendingScrollClearTimerRef.current);
                pendingScrollClearTimerRef.current = setTimeout(() => {
                  pendingUserSendRef.current = false;
                  pendingScrollClearTimerRef.current = null;
                }, 900);
              }}
            />

            <View style={styles.inputDock}>
              <View style={{ paddingBottom: keyboardOpen ? 8 : bottomInsetPad }}>
                {supportSendError ? (
                  <Text style={{ paddingHorizontal: 16, paddingBottom: 6, fontSize: 12, color: '#DC2626', fontWeight: '600' }}>
                    {supportSendError}
                  </Text>
                ) : null}
                <View style={styles.inputAreaWrapper}>
                  <View style={styles.inputContainer}>
                    <View style={styles.inputWrap}>
                      <TextInput
                        style={styles.input}
                        placeholder="Message…"
                        placeholderTextColor="#94A3B8"
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.sendButtonWrap}
                      onPress={sendMessage}
                      disabled={supportSending}
                      activeOpacity={0.85}
                    >
                      <LinearGradient
                        colors={['#FF6A3D', '#F54E25', '#E8441A']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.sendButton}
                      >
                        {supportSending ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Ionicons
                            name="send"
                            size={17}
                            color="#FFFFFF"
                            style={styles.sendIcon}
                          />
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>
      )}

      {!activeThreadId ? <FamilyWebMobileNav active="none" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EDF3',
  },
  selectionHeaderCenter: {
    flex: 1,
    alignItems: 'center',
  },
  selectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A2B4A',
  },
  selectionHeaderSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  inboxHero: {
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 16,
    position: 'relative',
  },
  inboxHeroWash: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '50%',
    backgroundColor: 'rgba(74, 40, 50, 0.35)',
    borderTopLeftRadius: 80,
  },
  inboxHeroInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    zIndex: 1,
  },
  inboxHeroIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inboxHeroCopy: { flex: 1, minWidth: 0 },
  inboxHeroEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: '#FF8A65',
    marginBottom: 4,
  },
  inboxHeroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  inboxHeroSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 17,
    fontWeight: '500',
  },
  supportBrandBadge: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EDF3',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(15, 23, 42, 0.08)' },
      default: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
      },
    }),
  },
  supportBrandLogo: {
    width: '100%',
    height: '100%',
  },
  notifModalRoot: {
    flex: 1,
  },
  notifModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  notificationsDropdown: {
    position: 'absolute',
    width: Math.min(340, width - 32),
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9EDF7',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#1B2559',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
  notificationsDropdownTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  notificationsDropdownTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1B2559',
  },
  notificationsDropdownRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  notificationsDropdownText: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  notificationDismiss: { fontSize: 18, lineHeight: 18, color: '#94A3B8', fontWeight: '700', paddingHorizontal: 2 },
  inboxOverflowMenu: {
    position: 'absolute',
    width: 220,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9EDF7',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 4,
    shadowColor: '#1B2559',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
  inboxOverflowMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  inboxOverflowMenuText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1B2559',
  },
  headerCancelBtn: {
    minWidth: 64,
    justifyContent: 'center',
  },
  headerCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F54E25',
  },
  archivesBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  archivesBannerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1B2559',
  },
  inboxFilterScroll: {
    flex: 1,
    minWidth: 0,
  },
  inboxFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 4,
    gap: 8,
  },
  headerEndSpacer: {
    minWidth: 64,
  },
  inboxFilterPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 4,
  },
  inboxFilterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EDF3',
  },
  inboxFilterPillActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  inboxFilterPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  inboxFilterPillTextActive: {
    color: '#C2410C',
  },
  inboxFilterPillTextDisabled: {
    opacity: 0.45,
  },
  inboxOverflowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inboxOverflowBtnPlaceholder: {
    width: 36,
    height: 36,
  },
  inboxSelectionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E9EDF7',
  },
  inboxSelectionBarAction: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563EB',
  },
  inboxSelectionBarDelete: {
    fontSize: 15,
    fontWeight: '600',
    color: '#DC2626',
  },
  inboxEmptyText: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  inboxBody: {
    flex: 1,
    position: 'relative',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    backgroundColor: '#F8FAFC',
  },
  searchIcon: {
    marginRight: 10,
    alignSelf: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A2B4A',
    paddingVertical: Platform.OS === 'web' ? 12 : 10,
    ...Platform.select({
      web: { outlineStyle: 'none' as const },
      default: {},
    }),
  },
  inboxHint: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  threadListFlex: {
    flex: 1,
  },
  threadList: {
    paddingHorizontal: 20,
    flexGrow: 1,
  },
  inboxLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  threadSelectCol: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  threadSelectCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  threadSelectCircleOn: {
    borderColor: '#2563EB',
    backgroundColor: '#2563EB',
  },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EDF3',
    ...Platform.select({
      web: { boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)' },
      default: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
      },
    }),
  },
  threadRowSelected: {
    borderColor: '#FED7AA',
    backgroundColor: '#FFFBF7',
  },
  threadAvatarWrap: {
    marginRight: 12,
  },
  threadAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  threadAvatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#4338CA',
  },
  threadTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  threadUnreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F54E25',
  },
  threadChevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  threadBody: {
    flex: 1,
    minWidth: 0,
  },
  threadTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A2B4A',
    flexShrink: 1,
  },
  threadSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  chatRoot: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'column',
    backgroundColor: '#F4F7FE',
  },
  chatKav: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    minHeight: 60,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EDF3',
    overflow: 'hidden',
    position: 'relative',
    zIndex: 2,
  },
  chatHeaderAccent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: '#F54E25',
    opacity: 0.85,
  },
  chatBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    zIndex: 1,
  },
  chatHeaderInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    zIndex: 1,
  },
  chatHeaderAvatarWrap: {
    marginRight: 10,
  },
  chatHeaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  chatHeaderAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4338CA',
  },
  chatHeaderTextCol: {
    flex: 1,
    minWidth: 0,
  },
  chatHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A2B4A',
  },
  chatHeaderSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    flexShrink: 1,
  },
  chatHeaderStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  chatHeaderStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  chatHeaderSpacer: {
    width: 36,
    zIndex: 1,
  },
  chatMessagesFlex: {
    flex: 1,
    minHeight: 0,
  },
  /** Web: bounded scroll area (RN has no overflow-y; this mirrors fixed-height + overflow:auto). */
  chatMessagesWeb: {
    minHeight: 0,
    overflow: 'scroll' as const,
  },
  chatBottomAnchor: {
    height: 8,
    width: '100%',
  },
  chatList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  chatListContent: {
    flexGrow: 1,
  },
  chatWelcomeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    padding: 14,
    marginBottom: 16,
  },
  chatWelcomeIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  chatWelcomeCopy: { flex: 1, minWidth: 0 },
  chatWelcomeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1A2B4A',
    marginBottom: 4,
  },
  chatWelcomeSub: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    fontWeight: '500',
  },
  dateSeparatorWrap: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  dateSeparatorText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    backgroundColor: '#EEF2F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },
  messageBlock: {
    width: '100%',
  },
  messageRowSupport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
  },
  messageRowUser: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    width: '100%',
  },
  messageMetaBlock: {
    marginTop: 4,
  },
  messageMetaBlockSupport: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  messageMetaBlockUser: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  bubbleHeadWrap: {
    alignSelf: 'center',
  },
  bubbleColumn: {
    flexShrink: 1,
    maxWidth: '78%',
  },
  bubbleColumnSupport: {
    alignItems: 'flex-start',
  },
  bubbleColumnUser: {
    alignItems: 'flex-end',
  },
  stackTight: {
    marginBottom: 3,
  },
  stackLoose: {
    marginBottom: 18,
  },
  userExpandedTime: {
    marginTop: 4,
    alignSelf: 'flex-end',
    color: '#94A3B8',
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  userBubble: {
    borderBottomRightRadius: 6,
    ...Platform.select({
      web: { boxShadow: '0 4px 14px rgba(245, 78, 37, 0.28)' },
      default: {
        shadowColor: '#F54E25',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 10,
        elevation: 3,
      },
    }),
  },
  supportBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: '#E8EDF3',
  },
  messageText: {
    fontSize: 15,
  },
  userText: {
    color: '#FFFFFF',
  },
  supportText: {
    color: '#1A2B4A',
    lineHeight: 21,
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
  inputDock: {
    flexShrink: 0,
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E8EDF3',
  },
  inputAreaWrapper: {
    backgroundColor: '#FFFFFF',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  inputWrap: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: Platform.select({ web: 12, ios: 11, default: 10 }),
  },
  input: {
    width: '100%',
    fontSize: 15,
    lineHeight: 20,
    color: '#1A2B4A',
    padding: 0,
    margin: 0,
    minHeight: 20,
    maxHeight: 80,
    ...Platform.select({
      web: {
        outlineStyle: 'none' as const,
      },
      android: {
        textAlignVertical: 'center' as const,
        includeFontPadding: false,
      },
      default: {},
    }),
  },
  sendButtonWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    flexShrink: 0,
  },
  sendButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIcon: {
    marginLeft: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderColor: '#F1F1F1',
    backgroundColor: '#FFFFFF',
    paddingTop: 10,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
