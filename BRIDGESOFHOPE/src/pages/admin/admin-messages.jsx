import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  MessageCircle,
  Send,
  Search,
} from 'lucide-react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { familySidebarStyle } from '@/lib/familySidebarStyle';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  fetchAdminInboxThreads,
  fetchFamilyThread,
  markThreadReadByAdmin,
  sendAdminMessage,
  subscribeAdminInbox,
  subscribeSupportMessages,
} from '@/lib/supportMessaging';
import '@/styles/admin-messages.css';

function formatRelative(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return 'Just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function displayInitials(name) {
  const parts = String(name || 'F').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
  }
  return (parts[0]?.[0] || 'F').toUpperCase();
}

export default function AdminMessagesPage() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [threads, setThreads] = useState([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [threadsError, setThreadsError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedFamilyId, setSelectedFamilyId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const chatBodyRef = useRef(null);
  const refreshTimerRef = useRef(null);

  const loadThreads = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setThreadsLoading(true);
    try {
      if (!isSupabaseConfigured()) {
        setThreadsError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to use live messaging.');
      } else {
        setThreadsError(null);
      }
      const rows = await fetchAdminInboxThreads();
      setThreads(rows);
    } catch (err) {
      console.warn('[admin-messages] loadThreads', err);
      setThreadsError(err?.message || 'Could not load conversations.');
    } finally {
      if (!silent) setThreadsLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (familyId, { silent = false } = {}) => {
    if (!familyId) {
      setMessages([]);
      return;
    }
    if (!silent) setMessagesLoading(true);
    try {
      const rows = await fetchFamilyThread(familyId);
      setMessages(rows.filter((m) => m.id !== 'welcome'));
      setMessagesError(null);
    } catch (err) {
      setMessagesError(err?.message || 'Could not load messages.');
    } finally {
      if (!silent) setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadThreads();
    return subscribeAdminInbox(() => loadThreads({ silent: true }));
  }, [loadThreads]);

  const clearUnreadForFamily = useCallback(
    (rows, familyId) =>
      rows.map((t) =>
        String(t.familyId) === String(familyId) ? { ...t, unreadCount: 0 } : t
      ),
    []
  );

  const refreshActiveThread = useCallback(
    async (familyId, { silent = true } = {}) => {
      const fid = String(familyId);
      if (!fid) return;
      await loadMessages(fid, { silent });
      const fresh = await fetchAdminInboxThreads();
      setThreads(clearUnreadForFamily(fresh, fid));
    },
    [loadMessages, clearUnreadForFamily]
  );

  useEffect(() => {
    if (!selectedFamilyId) return undefined;
    const fid = String(selectedFamilyId);
    loadMessages(fid, { silent: false });
    const onRealtime = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        refreshActiveThread(fid, { silent: true });
      }, 350);
    };
    return subscribeSupportMessages(fid, onRealtime);
  }, [selectedFamilyId, loadMessages, refreshActiveThread]);

  useEffect(
    () => () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    },
    []
  );

  const handleSelectThread = useCallback(
    async (familyId) => {
      const fid = String(familyId);
      if (!fid) return;
      setSelectedFamilyId(fid);
      setThreads((prev) => clearUnreadForFamily(prev, fid));
      await markThreadReadByAdmin(fid, { notify: false });
      await refreshActiveThread(fid, { silent: true });
    },
    [clearUnreadForFamily, refreshActiveThread]
  );

  useEffect(() => {
    if (!chatBodyRef.current) return;
    chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
  }, [messages, selectedFamilyId, sending]);

  const filteredThreads = threads.filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      t.fullName.toLowerCase().includes(q) ||
      (t.email || '').toLowerCase().includes(q) ||
      (t.lastMessage || '').toLowerCase().includes(q)
    );
  });

  const selectedThread = threads.find((t) => String(t.familyId) === String(selectedFamilyId));

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || !selectedFamilyId || sending) return;
    setSending(true);
    setSendError('');
    setInputValue('');
    const { message: saved, error } = await sendAdminMessage(selectedFamilyId, text);
    setSending(false);
    if (saved) {
      setMessages((prev) => [...prev, saved]);
      await loadThreads({ silent: true });
    } else {
      setInputValue(text);
      const msg = error || 'Could not send message. Check Supabase connection and admin permissions.';
      setSendError(msg);
      console.warn('[admin-messages] send failed:', msg);
    }
  };

  return (
    <div className="family-portal admin-portal-layout admin-messages-shell am-outer" style={familySidebarStyle(isExpanded)}>
      <AdminSidebar
        isExpanded={isExpanded}
        onToggleExpanded={() => setIsExpanded(!isExpanded)}
      />

      <main className="am-main admin-sidebar-offset">
        <header className="am-main-header">
          <div className="am-page-head">
            <div>
              <h1>Messages</h1>
              <p>Chat with users — messages sent here appear in their support chat on web and mobile.</p>
              {threadsError ? (
                <p className="am-alert am-alert--error">{threadsError}</p>
              ) : null}
              {!isSupabaseConfigured() ? (
                <p className="am-alert am-alert--warn">
                  Running in offline mode — messages are stored in this browser only until Supabase is configured.
                </p>
              ) : null}
            </div>
          </div>
        </header>

        <div className="msg-layout">
          <section className="msg-inbox" aria-label="Family conversations">
            <div className="msg-inbox-head">
              <div className="msg-inbox-title">
                All users
                {!threadsLoading && threads.length ? (
                  <span className="msg-inbox-count">({threads.length})</span>
                ) : null}
              </div>
              <div className="msg-inbox-search">
                <Search size={18} aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search by name or message…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search conversations"
                />
              </div>
            </div>
            <div className="msg-thread-list">
              {threadsLoading && !threads.length && (
                <div className="msg-list-loading">Loading…</div>
              )}
              {!threadsLoading && !filteredThreads.length && (
                <div className="msg-list-empty">
                  No users found. Add users in User Management or wait for family sign-ups.
                </div>
              )}
              {filteredThreads.map((t) => {
                const isActive = String(selectedFamilyId) === String(t.familyId);
                const hasUnread = t.unreadCount > 0;
                return (
                  <button
                    key={t.familyId}
                    type="button"
                    className={`msg-thread-item${isActive ? ' active' : ''}${hasUnread ? ' msg-thread-item--unread' : ''}`}
                    onClick={() => handleSelectThread(t.familyId)}
                  >
                    <div className="msg-thread-avatar" aria-hidden="true">
                      {displayInitials(t.fullName)}
                    </div>
                    <div className="msg-thread-content">
                      <div className="msg-thread-name">
                        <span>{t.fullName}</span>
                        <span className="msg-thread-meta">
                          {hasUnread ? <span className="msg-unread">{t.unreadCount}</span> : null}
                          <span className="msg-thread-time">{formatRelative(t.lastAt)}</span>
                        </span>
                      </div>
                      <div className="msg-thread-preview">{t.lastMessage || 'No messages yet'}</div>
                      {t.email ? <div className="msg-thread-email">{t.email}</div> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="msg-chat-panel" aria-label="Conversation">
            {!selectedFamilyId ? (
              <div className="msg-empty">
                <div className="msg-empty-graphic" aria-hidden="true">
                  <MessageCircle size={40} strokeWidth={1.75} />
                </div>
                <h2>Select a conversation</h2>
                <p>Choose a family user from the inbox to view and reply to their messages.</p>
              </div>
            ) : (
              <>
                <header className="msg-chat-head">
                  <div className="msg-chat-avatar" aria-hidden="true">
                    {displayInitials(selectedThread?.fullName || 'F')}
                  </div>
                  <div className="msg-chat-head-text">
                    <div className="msg-chat-head-name">{selectedThread?.fullName || 'Family user'}</div>
                    <div className="msg-chat-head-sub">{selectedThread?.email || 'Family member'}</div>
                  </div>
                </header>
                <div className="msg-chat-body" ref={chatBodyRef}>
                  {messagesError ? (
                    <div className="msg-chat-notice msg-chat-notice--error">{messagesError}</div>
                  ) : null}
                  {messagesLoading && !messages.length && (
                    <div className="msg-chat-notice msg-chat-notice--muted">Loading messages…</div>
                  )}
                  {!messagesLoading && !messages.length && (
                    <div className="msg-chat-notice msg-chat-notice--muted">
                      No messages yet. Send a greeting to start the conversation.
                    </div>
                  )}
                  {messages.map((msg, index) => {
                    const isIncoming = msg.sender === 'user';
                    const prev = messages[index - 1];
                    const isGrouped = prev?.sender === msg.sender;
                    return (
                      <div
                        key={msg.id}
                        className={`msg-row msg-row--${isIncoming ? 'in' : 'out'}${isGrouped ? ' msg-row--grouped' : ''}`}
                      >
                        {isIncoming ? (
                          <div
                            className={`msg-row-avatar${isGrouped ? ' msg-row-avatar--spacer' : ''}`}
                            aria-hidden="true"
                          >
                            {displayInitials(selectedThread?.fullName || 'F')}
                          </div>
                        ) : null}
                        <div className={`msg-bubble ${isIncoming ? 'in' : 'out'}`}>
                          {msg.text}
                          {msg.time ? (
                            <div className="msg-bubble-time">{msg.time}</div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {sendError ? (
                  <div className="msg-send-error">{sendError}</div>
                ) : null}
                <div className="msg-chat-input">
                  <div className="msg-chat-input-wrap">
                    <input
                      type="text"
                      placeholder="Type a reply…"
                      value={inputValue}
                      onChange={(e) => {
                        setInputValue(e.target.value);
                        if (sendError) setSendError('');
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                      disabled={sending}
                      aria-label="Message reply"
                    />
                  </div>
                  <button
                    type="button"
                    className="msg-send-btn"
                    onClick={handleSend}
                    disabled={!inputValue.trim() || sending}
                    aria-label="Send message"
                  >
                    <Send size={18} color="#fff" strokeWidth={2} />
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
