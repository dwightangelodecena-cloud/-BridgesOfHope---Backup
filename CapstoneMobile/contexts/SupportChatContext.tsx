import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useFamilyUserMobile } from "../lib/useFamilyUserMobile";
import { isSupabaseConfigured } from "../lib/supabase";
import {
  fetchFamilyThread,
  fetchFamilyUnreadAdminCount,
  markThreadReadByFamily,
  sendFamilyMessage,
  subscribeSupportMessages,
  supportWelcomeMessage,
  type SupportUiMessage,
} from "../lib/supportMessagingMobile";

export type SupportChatContextValue = {
  familyId: string | null;
  messages: SupportUiMessage[];
  loading: boolean;
  sending: boolean;
  sendError: string;
  unreadCount: number;
  isChatOpen: boolean;
  setIsChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  sendMessage: (text: string) => Promise<boolean>;
  reload: (opts?: { silent?: boolean }) => Promise<void>;
  refreshUnread: () => Promise<void>;
  markSupportAsRead: () => Promise<void>;
};

const SupportChatContext = createContext<SupportChatContextValue | null>(null);

function withWelcome(rows: SupportUiMessage[]): SupportUiMessage[] {
  const list = Array.isArray(rows) ? rows : [];
  const persisted = list.filter((m) => m.id !== "welcome");
  if (!persisted.length) return [supportWelcomeMessage()];
  return persisted;
}

export function SupportChatProvider({ children }: { children: ReactNode }) {
  const { userId, loading: userLoading } = useFamilyUserMobile();
  const familyId =
    userId && userId !== "local-family" && isSupabaseConfigured() ? userId : null;

  const [messages, setMessages] = useState<SupportUiMessage[]>([supportWelcomeMessage()]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const refreshUnread = useCallback(async () => {
    if (!familyId) {
      setUnreadCount(0);
      return;
    }
    const n = await fetchFamilyUnreadAdminCount(familyId);
    setUnreadCount(n);
  }, [familyId]);

  const markSupportAsRead = useCallback(async () => {
    if (!familyId) return;
    await markThreadReadByFamily(familyId);
    await refreshUnread();
  }, [familyId, refreshUnread]);

  const reload = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      const { silent = false } = opts;
      if (!familyId) {
        setMessages([supportWelcomeMessage()]);
        setLoading(false);
        setUnreadCount(0);
        return;
      }
      if (!silent) setLoading(true);
      try {
        const rows = await fetchFamilyThread(familyId);
        setMessages(withWelcome(rows));
        setSendError("");
        await refreshUnread();
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [familyId, refreshUnread]
  );

  useEffect(() => {
    if (userLoading) return;
    reload();
  }, [reload, userLoading]);

  useEffect(() => {
    if (!familyId) return undefined;
    return subscribeSupportMessages(familyId, () => {
      reload({ silent: true });
    });
  }, [familyId, reload]);

  useEffect(() => {
    if (!isChatOpen || !familyId) return;
    void markThreadReadByFamily(familyId).then(() => refreshUnread());
  }, [isChatOpen, familyId, messages, refreshUnread]);

  const sendMessage = useCallback(
    async (rawText: string): Promise<boolean> => {
      const text = String(rawText || "").trim();
      if (!text || sending || !familyId) return false;

      setSendError("");
      setSending(true);
      const pendingId = `pending-${Date.now()}`;
      const optimistic: SupportUiMessage = {
        id: pendingId,
        text,
        sender: "user",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...withWelcome(prev), optimistic]);

      const { message: saved, error } = await sendFamilyMessage(familyId, text);
      setSending(false);

      if (saved) {
        setMessages((prev) => {
          const rest = prev.filter((m) => m.id !== pendingId && m.id !== "welcome");
          return [...rest, saved];
        });
        return true;
      }

      setSendError(error || "Could not send message. Try again.");
      setMessages((prev) => prev.filter((m) => m.id !== pendingId));
      return false;
    },
    [familyId, sending]
  );

  const value = useMemo<SupportChatContextValue>(
    () => ({
      familyId,
      messages,
      loading,
      sending,
      sendError,
      unreadCount,
      isChatOpen,
      setIsChatOpen,
      sendMessage,
      reload,
      refreshUnread,
      markSupportAsRead,
    }),
    [
      familyId,
      messages,
      loading,
      sending,
      sendError,
      unreadCount,
      isChatOpen,
      sendMessage,
      reload,
      refreshUnread,
      markSupportAsRead,
    ]
  );

  return <SupportChatContext.Provider value={value}>{children}</SupportChatContext.Provider>;
}

export function useSupportChatMobile(): SupportChatContextValue {
  const ctx = useContext(SupportChatContext);
  if (!ctx) {
    throw new Error("useSupportChatMobile must be used within SupportChatProvider");
  }
  return ctx;
}
