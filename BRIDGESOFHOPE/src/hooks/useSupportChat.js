import { useCallback, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  fetchFamilyThread,
  markThreadReadByFamily,
  sendFamilyMessage,
  subscribeSupportMessages,
  supportWelcomeMessage,
} from '@/lib/supportMessaging';

function withWelcome(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const persisted = list.filter((m) => m.id !== 'welcome');
  if (!persisted.length) return [supportWelcomeMessage()];
  return persisted;
}

function persistFamilyUserId(userId) {
  if (!userId) return;
  try {
    const raw = localStorage.getItem('bh_family_profile');
    const base = raw ? JSON.parse(raw) : {};
    localStorage.setItem(
      'bh_family_profile',
      JSON.stringify({ ...base, userId: String(userId) })
    );
  } catch {
    localStorage.setItem('bh_family_profile', JSON.stringify({ userId: String(userId) }));
  }
}

export function useSupportChat() {
  const [familyId, setFamilyId] = useState(null);
  const [messages, setMessages] = useState([supportWelcomeMessage()]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadUser = async () => {
      if (!isSupabaseConfigured()) {
        const fallback = localStorage.getItem('bh_family_profile');
        let id = 'local-family';
        try {
          if (fallback) {
            const parsed = JSON.parse(fallback);
            id = parsed.userId || parsed.id || id;
          }
        } catch {
          /* ignore */
        }
        if (mounted) setFamilyId(id);
        return;
      }
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id || null;
      if (uid) persistFamilyUserId(uid);
      if (mounted) setFamilyId(uid);
    };
    loadUser();
    return () => {
      mounted = false;
    };
  }, []);

  const reload = useCallback(
    async (opts = {}) => {
      const { silent = false } = opts;
      if (!familyId) {
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      try {
        const rows = await fetchFamilyThread(familyId);
        setMessages(withWelcome(rows));
        setSendError('');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [familyId]
  );

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!familyId) return undefined;
    return subscribeSupportMessages(familyId, () => reload({ silent: true }));
  }, [familyId, reload]);

  useEffect(() => {
    if (!isChatOpen || !familyId) return;
    markThreadReadByFamily(familyId);
  }, [isChatOpen, familyId, messages]);

  const sendMessage = async (rawText) => {
    const text = String(rawText || '').trim();
    if (!text || sending || !familyId) return false;

    setSendError('');
    setSending(true);
    const pendingId = `pending-${Date.now()}`;
    const optimistic = {
      id: pendingId,
      text,
      sender: 'user',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...withWelcome(prev), optimistic]);

    const { message: saved, error } = await sendFamilyMessage(familyId, text);
    setSending(false);

    if (saved) {
      setMessages((prev) => {
        const rest = prev.filter((m) => m.id !== pendingId && m.id !== 'welcome');
        return [...rest, saved];
      });
      return true;
    }

    setSendError(error || 'Could not send message. Try again.');
    setMessages((prev) => prev.filter((m) => m.id !== pendingId));
    return false;
  };

  return {
    familyId,
    messages,
    loading,
    sending,
    sendError,
    isChatOpen,
    setIsChatOpen,
    sendMessage,
    reload,
  };
}
