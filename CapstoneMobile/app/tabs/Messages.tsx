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
  InteractionManager,
  ScrollView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { TAB_ROUTES } from '../../lib/navigationConfig';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { FamilyWebMobileNav } from '../../components/family/FamilyWebMobileNav';
import { FamilyFloatingChat } from '../../components/family/FamilyFloatingChat';
import { uiPatientFromRow, type PatientRow, type UIPatient } from '../../lib/patientMappers';

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

const NOTIFICATION_ITEMS = [
  'Submit missing laboratory result before Friday.',
  'Family support session is scheduled on April 5, 10:00 AM.',
  'Weekly report reviewed by your assigned counselor.',
];

function deriveInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => (p[0] ? p[0].toUpperCase() : '')).join('') || 'FU';
}

function patientInitials(name: string): string {
  const parts = String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  const s = parts.map((p) => (p[0] ? p[0].toUpperCase() : '')).join('');
  return s || 'P';
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

const AVATAR_HEAD = 34;
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

const demoBaseMs = Date.now() - 2.5 * 60 * 60 * 1000;

const initialSupportMessages: Message[] = [
  {
    id: '1',
    text: 'Hello! How can we help you today?',
    sender: 'support',
    createdAtMs: demoBaseMs,
    showTime: false,
  },
  {
    id: '2',
    text: "Hi! I'm having trouble accessing my account dashboard. Can you help?",
    sender: 'user',
    createdAtMs: demoBaseMs + 90 * 1000,
  },
  {
    id: '3',
    text: 'Thank you for your message! A member of our staff will respond to you soon. We appreciate your patience.',
    sender: 'support',
    createdAtMs: demoBaseMs + 3 * 60 * 1000,
    showTime: false,
  },
];

type ThreadRow =
  | { id: string; kind: 'support'; title: string; subtitle: string }
  | { id: string; kind: 'patient'; patient: UIPatient; subtitle: string };

export default function MessageScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [inputText, setInputText] = useState('');
  /** Scroll container (FlatList). */
  const flatListRef = useRef<FlatList>(null);
  const flatListViewportHRef = useRef(0);
  /** Web: DOM node at end of thread for scrollIntoView / scrollHeight sync; native: list footer anchor. */
  const bottomAnchorRef = useRef<View>(null);
  const latestPendingSeenIdRef = useRef<string | null>(null);

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
  const [displayName, setDisplayName] = useState('Family User');
  const [userInitials, setUserInitials] = useState('FU');
  const [patients, setPatients] = useState<UIPatient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(true);

  const [messagesByThread, setMessagesByThread] = useState<Record<string, Message[]>>({
    [SUPPORT_THREAD_ID]: initialSupportMessages,
  });
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

  const loadPatients = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setPatients([]);
      setPatientsLoading(false);
      return;
    }
    setPatientsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        setPatients([]);
        return;
      }
      const { data, error } = await supabase
        .from('patients')
        .select(
          'id, full_name, admitted_at, progress_percent, clinical_status, primary_concern, family_id, discharged_at'
        )
        .eq('family_id', user.id)
        .is('discharged_at', null)
        .order('admitted_at', { ascending: false });

      if (error) {
        console.warn('[messages patients]', error.message);
        setPatients([]);
        return;
      }
      const list = (data || [])
        .map((r) => uiPatientFromRow(r as unknown as PatientRow))
        .filter((x): x is UIPatient => x != null);
      setPatients(list);
    } catch {
      setPatients([]);
    } finally {
      setPatientsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPatients();
    }, [loadPatients])
  );

  useEffect(() => {
    let mounted = true;
    const loadUser = async () => {
      if (!isSupabaseConfigured()) return;
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user;
        let resolved =
          (user?.user_metadata?.full_name as string | undefined)?.trim() ||
          [user?.user_metadata?.first_name, user?.user_metadata?.last_name]
            .filter(Boolean)
            .join(' ')
            .trim() ||
          'Family User';
        if (user?.id) {
          const { data: profileRow } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .maybeSingle();
          if (profileRow?.full_name?.trim()) resolved = profileRow.full_name.trim();
        }
        if (mounted) {
          setDisplayName(resolved);
          setUserInitials(deriveInitials(resolved));
        }
      } catch {
        /* keep defaults */
      }
    };
    loadUser();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

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
    const patientRows: ThreadRow[] = patients.map((p) => {
      const tmsgs = messagesByThread[String(p.id)] ?? [];
      const last = tmsgs[tmsgs.length - 1];
      const sub = last
        ? `${last.text.slice(0, 36)}${last.text.length > 36 ? '…' : ''} · ${formatRelativeShort(nowTick, last.createdAtMs)}`
        : `Patient · Admitted ${p.date || '—'}`;
      return {
        id: String(p.id),
        kind: 'patient' as const,
        patient: p,
        subtitle: sub,
      };
    });
    const all = [support, ...patientRows];
    if (!q) return all;
    return all.filter((row) => {
      if (row.kind === 'support') {
        return (
          row.title.toLowerCase().includes(q) ||
          row.subtitle.toLowerCase().includes(q)
        );
      }
      return (row.patient.name || '').toLowerCase().includes(q);
    });
  }, [patients, searchQuery, messagesByThread, nowTick]);

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

  const activeThreadTitle = useMemo(() => {
    if (!activeThreadId) return '';
    if (activeThreadId === SUPPORT_THREAD_ID) return 'Bridges of Hope';
    const p = patients.find((x) => String(x.id) === activeThreadId);
    return p?.name || 'Chat';
  }, [activeThreadId, patients]);

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
    () => [styles.chatList, styles.chatListContentMessenger],
    []
  );

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
    setUnreadByThread((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setActiveThreadId(id);
    setMessagesByThread((prev) => {
      if (prev[id]) return prev;
      if (id === SUPPORT_THREAD_ID) return prev;
      return {
        ...prev,
        [id]: [
          {
            id: `welcome-${id}`,
            text: 'Start a conversation about this patient. Our care team may reply during business hours.',
            sender: 'support',
            createdAtMs: Date.now(),
            showTime: false,
          },
        ],
      };
    });
    nearBottomRef.current = true;
    setTimeout(
      () => scrollChatToBottom(false, { bypassLayoutSuppress: true, ignoreNearBottom: true }),
      100
    );
  };

  const sendMessage = () => {
    if (!activeThreadId || inputText.trim().length === 0) return;

    const nowMs = Date.now();
    const messageId = `${nowMs}`;
    const newMessage: Message = {
      id: messageId,
      text: inputText.trim(),
      sender: 'user',
      createdAtMs: nowMs,
      receipt: 'sent',
    };

    pendingUserSendRef.current = true;
    suppressLayoutAutoScrollRef.current = false;
    if (suppressLayoutAutoScrollTimerRef.current) {
      clearTimeout(suppressLayoutAutoScrollTimerRef.current);
      suppressLayoutAutoScrollTimerRef.current = null;
    }

    setMessagesByThread((prev) => {
      const list = prev[activeThreadId] ?? [];
      const cleared = list.map((m) =>
        m.sender === 'user' ? { ...m, seenAt: undefined, receipt: undefined } : m
      );
      return { ...prev, [activeThreadId]: [...cleared, newMessage] };
    });
    setInputText('');
    nearBottomRef.current = true;

    scrollChatToBottom(false, { bypassLayoutSuppress: true, ignoreNearBottom: true });
    scrollChatToBottom(true, { bypassLayoutSuppress: true, ignoreNearBottom: true });
    InteractionManager.runAfterInteractions(() => {
      scrollChatToBottom(false, { bypassLayoutSuppress: true, ignoreNearBottom: true });
      scrollChatToBottom(true, { bypassLayoutSuppress: true, ignoreNearBottom: true });
    });

    latestPendingSeenIdRef.current = messageId;

    setTimeout(() => {
      if (latestPendingSeenIdRef.current !== messageId) return;
      setMessagesByThread((prev) => ({
        ...prev,
        [activeThreadId]: prev[activeThreadId]?.map((m) =>
          m.id === messageId ? { ...m, receipt: 'delivered' as const } : m
        ) ?? [],
      }));
      setTimeout(() => scrollChatToBottom(true, { bypassLayoutSuppress: true }), 16);
    }, 450);

    setTimeout(() => {
      if (latestPendingSeenIdRef.current !== messageId) return;
      const seenTime = formatMessageTime(Date.now());
      setMessagesByThread((prev) => ({
        ...prev,
        [activeThreadId]: prev[activeThreadId]?.map((m) =>
          m.id === messageId ? { ...m, seenAt: seenTime, receipt: undefined } : m
        ) ?? [],
      }));
      setTimeout(() => scrollChatToBottom(true, { bypassLayoutSuppress: true }), 16);
    }, 2200);
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
      <View style={[styles.bubbleHead, styles.bubbleHeadSupport, { marginRight: AVATAR_GAP }]}>
        <Ionicons name="medkit" size={16} color="#FFFFFF" />
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
    const isSupport = item.kind === 'support';
    const title = isSupport ? item.title : item.patient.name;
    const subtitle = item.subtitle;
    const selected = !!selectedThreadIds[item.id];

    return (
      <TouchableOpacity
        style={styles.threadRow}
        onPress={() => onInboxRowPress(item.id)}
        activeOpacity={0.85}
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
        <View style={[styles.threadAvatar, isSupport ? styles.threadAvatarSupport : null]}>
          {isSupport ? (
            <Ionicons name="medkit" size={22} color="#FFFFFF" />
          ) : (
            <Text style={styles.threadAvatarText}>{patientInitials(item.patient.name)}</Text>
          )}
        </View>
        <View style={styles.threadBody}>
          <Text style={styles.threadTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.threadSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        {inboxSelectionMode ? null : (
          <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
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
    <View style={[styles.screen, { paddingTop: insets.top }]}>
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
              <Ionicons name="checkmark-circle" size={20} color="#2B31ED" />
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
            {NOTIFICATION_ITEMS.map((notif) => (
              <View key={notif} style={styles.notificationsDropdownRow}>
                <Ionicons name="checkmark-circle" size={15} color="#2B31ED" />
                <Text style={styles.notificationsDropdownText}>{notif}</Text>
              </View>
            ))}
          </View>
        </View>
      </Modal>

      {!activeThreadId ? (
        <>
          <View style={styles.header}>
            {inboxSelectionMode ? (
              <>
                <TouchableOpacity
                  onPress={exitInboxSelectionMode}
                  hitSlop={12}
                  style={styles.headerCancelBtn}
                  accessibilityLabel="Cancel selection"
                >
                  <Text style={styles.headerCancelText}>Cancel</Text>
                </TouchableOpacity>
                <View style={[styles.headerCenter, styles.headerCenterSelection]}>
                  <Text style={styles.headerBrandTitle}>Select chats</Text>
                  {selectedInboxIds.length > 0 ? (
                    <Text style={styles.headerWelcomeLine} numberOfLines={1}>
                      {selectedInboxIds.length} selected
                    </Text>
                  ) : null}
                </View>
                <View style={styles.headerEndSpacer} />
              </>
            ) : (
              <>
                <View style={styles.headerCenter}>
                  <Text style={styles.headerBrandTitle}>Messages</Text>
                  <Text style={styles.headerWelcomeLine} numberOfLines={1}>
                    Welcome Back, {(displayName || 'Family User').trim().split(/\s+/)[0]}
                  </Text>
                </View>
                <View style={styles.headerActions}>
                  <TouchableOpacity
                    style={styles.headerCircleBtn}
                    onPress={() => setShowNotifications((v) => !v)}
                    accessibilityLabel="Notifications"
                  >
                    <Ionicons name="notifications" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.headerCircleBtn}
                    onPress={() => router.navigate(TAB_ROUTES.profile)}
                    accessibilityLabel="Profile"
                  >
                    <Text style={styles.headerAvatarText}>{userInitials}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          <View style={styles.inboxBody}>
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={18} color="#A3AED0" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search people to message…"
                placeholderTextColor="#A3AED0"
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

            {patientsLoading ? (
              <View style={styles.inboxLoading}>
                <ActivityIndicator size="large" color="#F54E25" />
              </View>
            ) : (
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
                    <Text style={styles.inboxHint}>Choose who you’d like to message</Text>
                  )
                }
                ListEmptyComponent={
                  <Text style={styles.inboxEmptyText}>{inboxEmptyLabel}</Text>
                }
              />
            )}
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
        <View style={styles.chatRoot}>
          <View style={styles.chatHeader}>
            <TouchableOpacity
              style={styles.chatBackBtn}
              onPress={() => setActiveThreadId(null)}
              hitSlop={12}
              accessibilityLabel="Back to inbox"
            >
              <Ionicons name="arrow-back" size={24} color="#1B2559" />
            </TouchableOpacity>
            <View style={styles.chatHeaderInfo}>
              <View
                style={[
                  styles.chatHeaderAvatar,
                  activeThreadId === SUPPORT_THREAD_ID ? styles.threadAvatarSupport : null,
                ]}
              >
                {activeThreadId === SUPPORT_THREAD_ID ? (
                  <Ionicons name="medkit" size={18} color="#FFFFFF" />
                ) : (
                  <Text style={styles.chatHeaderAvatarText}>
                    {patientInitials(activeThreadTitle)}
                  </Text>
                )}
              </View>
              <View style={styles.chatHeaderTextCol}>
                <Text style={styles.chatHeaderTitle} numberOfLines={1}>
                  {activeThreadTitle}
                </Text>
                <Text style={styles.chatHeaderSubtitle} numberOfLines={1}>
                  {activeThreadId === SUPPORT_THREAD_ID ? 'Care team' : 'Patient conversation'}
                </Text>
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
                <View style={styles.inputAreaWrapper}>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      placeholder="Message…"
                      placeholderTextColor="#94A3B8"
                      value={inputText}
                      onChangeText={setInputText}
                      multiline
                    />
                    <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
                      <Ionicons name="send" size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>
      )}

      {!activeThreadId ? (
        <>
          <FamilyWebMobileNav active="none" />
          <FamilyFloatingChat />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    minHeight: 56,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F1F1',
    zIndex: 10,
  },
  headerCenter: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  /** Centers title + subtitle in the header row (selection mode). */
  headerCenterSelection: {
    alignItems: 'center',
  },
  headerBrandTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F54E25',
  },
  headerWelcomeLine: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerCircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F54E25',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F54E25',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  headerAvatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
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
    color: '#2B31ED',
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
    backgroundColor: '#F1F5F9',
  },
  inboxFilterPillActive: {
    backgroundColor: '#DBEAFE',
  },
  inboxFilterPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1B2559',
  },
  inboxFilterPillTextActive: {
    color: '#1D4ED8',
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
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    backgroundColor: '#FAFAFA',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1B2559',
    paddingVertical: 0,
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
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E9EDF7',
  },
  threadAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  threadAvatarSupport: {
    backgroundColor: '#F54E25',
  },
  threadAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4338CA',
  },
  threadBody: {
    flex: 1,
    minWidth: 0,
  },
  threadTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B2559',
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
    minHeight: 56,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F1F1',
    backgroundColor: '#FFFFFF',
  },
  chatBackBtn: {
    padding: 4,
    marginRight: 4,
  },
  chatHeaderInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  chatHeaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E7FF',
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
    fontWeight: '700',
    color: '#1B2559',
  },
  chatHeaderSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  chatHeaderSpacer: {
    width: 32,
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
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  /** Short threads align to bottom of the list viewport; long threads scroll normally. */
  chatListContentMessenger: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  dateSeparatorWrap: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 14,
  },
  dateSeparatorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  messageBlock: {
    width: '100%',
  },
  messageRowSupport: {
    flexDirection: 'row',
    alignItems: 'flex-end',
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
  bubbleHead: {
    width: AVATAR_HEAD,
    height: AVATAR_HEAD,
    borderRadius: AVATAR_HEAD / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleHeadSupport: {
    backgroundColor: '#F54E25',
  },
  bubbleHeadUser: {
    backgroundColor: '#E0E7FF',
  },
  bubbleHeadUserText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4338CA',
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
  inputDock: {
    flexShrink: 0,
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  inputAreaWrapper: {
    backgroundColor: '#FFFFFF',
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
