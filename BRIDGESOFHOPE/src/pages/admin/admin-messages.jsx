import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  LayoutGrid,
  BookUser,
  Users,
  LogOut,
  ClipboardList,
  ArrowRightSquare,
  Stethoscope,
  LayoutTemplate,
  Calendar,
  User,
  FileText,
  MessageCircle,
  Send,
  Search,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logoBH from '@/assets/kalingalogo.png';
import {
  fetchAdminInboxThreads,
  fetchFamilyThread,
  markThreadReadByAdmin,
  sendAdminMessage,
  subscribeAdminInbox,
  subscribeSupportMessages,
} from '@/lib/supportMessaging';

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

export default function AdminMessagesPage() {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [threads, setThreads] = useState([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedFamilyId, setSelectedFamilyId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const chatBodyRef = useRef(null);
  const refreshTimerRef = useRef(null);

  const loadThreads = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setThreadsLoading(true);
    try {
      const rows = await fetchAdminInboxThreads();
      setThreads(rows);
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

  const selectedThread = threads.find((t) => t.familyId === selectedFamilyId);

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || !selectedFamilyId || sending) return;
    setSending(true);
    setInputValue('');
    const { message: saved, error } = await sendAdminMessage(selectedFamilyId, text);
    setSending(false);
    if (saved) {
      setMessages((prev) => [...prev, saved]);
      await loadThreads({ silent: true });
    } else if (error) {
      console.warn('[admin-messages] send failed:', error);
    }
  };

  return (
    <div className="am-outer">
      <style>{`
        .am-outer { display: flex; height: 100vh; max-height: 100vh; overflow: hidden; background: #F4F7FE; font-family: 'DM Sans', sans-serif; color: #1B2559; color-scheme: light; box-sizing: border-box; }
        .am-outer *, .am-outer *::before, .am-outer *::after { box-sizing: border-box; }
        .desktop-sidebar { width: ${isExpanded ? '280px' : '110px'}; background: white; border-right: 1px solid #F1F1F1; display: flex; flex-direction: column; padding: 25px 0 0; z-index: 100; transition: width 0.3s; cursor: pointer; position: fixed; top: 0; left: 0; height: 100vh; }
        .sidebar-logo-container { display: flex; justify-content: center; margin-bottom: 28px; }
        .sidebar-logo { width: ${isExpanded ? '120px' : '70px'}; transition: width 0.3s; }
        .sidebar-nav-scroll { flex: 1; overflow-y: auto; }
        .sidebar-nav-item { display: flex; align-items: center; width: 100%; padding: 0 ${isExpanded ? '28px' : '0'}; justify-content: ${isExpanded ? 'flex-start' : 'center'}; gap: 14px; margin-bottom: 6px; min-height: 48px; cursor: pointer; }
        .sidebar-label { display: ${isExpanded ? 'block' : 'none'}; font-weight: 600; font-size: 15px; color: #707EAE; }
        .icon-box { width: 44px; height: 44px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .icon-box.active { background: #FFF5F2; color: #F54E25; }
        .icon-box.inactive { background: transparent; color: #A3AED0; }
        .sidebar-footer { border-top: 1px solid #f1f5f9; padding: 16px 0 20px; }
        .am-main { margin-left: ${isExpanded ? '280px' : '110px'}; flex: 1; min-width: 0; min-height: 0; height: 100vh; padding: 16px 24px 20px; transition: margin-left 0.3s; color: #1B2559; display: flex; flex-direction: column; overflow: hidden; }
        .am-main-header { flex-shrink: 0; margin-bottom: 12px; }
        .am-main-header h1 { margin: 0 0 4px; font-size: 24px; font-weight: 800; color: #000; }
        .am-main-header p { margin: 0; font-size: 13px; color: #707EAE; }
        .msg-layout { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(260px, 320px) minmax(0, 1fr); gap: 16px; overflow: hidden; }
        .msg-inbox { background: #fff; border-radius: 20px; border: 1px solid #E9EDF7; display: flex; flex-direction: column; overflow: hidden; }
        .msg-inbox-head { padding: 18px; border-bottom: 1px solid #F1F5F9; }
        .msg-inbox-search { display: flex; align-items: center; gap: 10px; background: #F4F7FE; border-radius: 12px; padding: 10px 14px; margin-top: 12px; }
        .msg-inbox-search input { border: none; background: transparent; flex: 1; outline: none; font-size: 13px; color: #1B2559; caret-color: #1B2559; }
        .msg-inbox-search input::placeholder { color: #94A3B8; opacity: 1; }
        .msg-thread-list { flex: 1; overflow-y: auto; }
        .msg-thread-item { padding: 14px 18px; border-bottom: 1px solid #F8FAFC; cursor: pointer; transition: background 0.15s; }
        .msg-thread-item:hover, .msg-thread-item.active { background: #FFF7F4; }
        .msg-thread-name { font-size: 14px; font-weight: 700; color: #1B2559; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .msg-thread-preview { font-size: 12px; color: #707EAE; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .msg-unread { background: #F54E25; color: #fff; font-size: 10px; font-weight: 700; min-width: 20px; height: 20px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; padding: 0 6px; }
        .msg-chat-panel { background: #fff; border-radius: 20px; border: 1px solid #E9EDF7; display: flex; flex-direction: column; overflow: hidden; }
        .msg-chat-head { padding: 18px 22px; border-bottom: 1px solid #F1F5F9; display: flex; align-items: center; gap: 12px; }
        .msg-chat-avatar { width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg,#F54E25,#EA580C); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; }
        .msg-chat-body { flex: 1; padding: 20px; background: #F8F9FD; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
        .msg-bubble { max-width: 72%; padding: 12px 16px; font-size: 13.5px; line-height: 1.45; border-radius: 16px; }
        .msg-bubble.in { background: #fff; color: #1B2559; align-self: flex-start; border-radius: 16px 16px 16px 4px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
        .msg-bubble.out { background: #F54E25; color: #fff; align-self: flex-end; border-radius: 16px 16px 4px 16px; }
        .msg-chat-input { padding: 16px 20px; border-top: 1px solid #F1F5F9; display: flex; gap: 12px; align-items: center; }
        .msg-chat-input input {
          flex: 1;
          border: none;
          background: #F4F7FE;
          border-radius: 14px;
          padding: 12px 16px;
          outline: none;
          font-size: 13px;
          color: #1B2559;
          caret-color: #1B2559;
          -webkit-text-fill-color: #1B2559;
        }
        .msg-chat-input input::placeholder { color: #94A3B8; opacity: 1; }
        .msg-chat-input input:disabled { color: #94A3B8; -webkit-text-fill-color: #94A3B8; }
        .msg-send-btn { width: 44px; height: 44px; min-width: 44px; border-radius: 12px; border: none; background: #F54E25; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; padding: 0; }
        .msg-send-btn svg { width: 18px !important; height: 18px !important; stroke-width: 2; }
        .msg-send-btn:disabled { background: #E9EDF7; cursor: not-allowed; }
        .msg-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #A3AED0; padding: 40px; text-align: center; }
        @media (max-width: 900px) {
          .desktop-sidebar { display: none; }
          .am-main { margin-left: 0; padding: 16px 12px 80px; }
          .msg-layout { grid-template-columns: 1fr; height: auto; }
          .msg-inbox { max-height: 280px; }
          .msg-chat-panel { min-height: 420px; }
        }
      `}</style>

      <aside className="desktop-sidebar" onClick={() => setIsExpanded((v) => !v)}>
        <div className="sidebar-logo-container">
          <img src={logoBH} alt="Kalinga" className="sidebar-logo" />
        </div>
        <nav className="sidebar-nav-scroll" aria-label="Admin navigation">
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-dashboard'); }}>
            <div className="icon-box inactive"><LayoutGrid size={22} /></div>
            <span className="sidebar-label">Dashboard</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-patient-database'); }}>
            <div className="icon-box inactive"><BookUser size={22} /></div>
            <span className="sidebar-label">Patient Management</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-admission-management'); }}>
            <div className="icon-box inactive"><ClipboardList size={22} /></div>
            <span className="sidebar-label">Admission Management</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-discharge-management'); }}>
            <div className="icon-box inactive"><ArrowRightSquare size={22} /></div>
            <span className="sidebar-label">Discharge Management</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-user-management'); }}>
            <div className="icon-box inactive"><Users size={22} /></div>
            <span className="sidebar-label">User Management</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-staff-management'); }}>
            <div className="icon-box inactive"><Stethoscope size={22} /></div>
            <span className="sidebar-label">Staff Management</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-content-management'); }}>
            <div className="icon-box inactive"><LayoutTemplate size={22} /></div>
            <span className="sidebar-label">Content management</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-appointments'); }}>
            <div className="icon-box inactive"><Calendar size={22} /></div>
            <span className="sidebar-label">Appointments</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => e.stopPropagation()}>
            <div className="icon-box active"><MessageCircle size={22} /></div>
            <span className="sidebar-label" style={{ color: '#F54E25' }}>Messages</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-reports'); }}>
            <div className="icon-box inactive"><FileText size={22} /></div>
            <span className="sidebar-label">Printable reports</span>
          </div>
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-profile'); }}>
            <div className="icon-box inactive"><User size={22} /></div>
            <span className="sidebar-label">Profile & Security</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/login'); }}>
            <LogOut size={22} color="#F54E25" style={{ marginLeft: isExpanded ? 0 : 10 }} />
            <span className="sidebar-label" style={{ color: '#F54E25' }}>Logout</span>
          </div>
        </div>
      </aside>

      <main className="am-main">
        <header className="am-main-header">
          <h1>Messages</h1>
          <p>Chat with family users — messages sent here appear in their support chat.</p>
        </header>

        <div className="msg-layout">
          <section className="msg-inbox" aria-label="Family conversations">
            <div className="msg-inbox-head">
              <div style={{ fontWeight: 800, fontSize: 15, color: '#1B2559' }}>Family users</div>
              <div className="msg-inbox-search">
                <Search size={18} color="#A3AED0" />
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
                <div style={{ padding: 20, fontSize: 13, color: '#A3AED0' }}>Loading…</div>
              )}
              {!threadsLoading && !filteredThreads.length && (
                <div style={{ padding: 20, fontSize: 13, color: '#A3AED0' }}>No family users yet.</div>
              )}
              {filteredThreads.map((t) => (
                <button
                  key={t.familyId}
                  type="button"
                  className={`msg-thread-item${selectedFamilyId === t.familyId ? ' active' : ''}`}
                  style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'left' }}
                  onClick={() => handleSelectThread(t.familyId)}
                >
                  <div className="msg-thread-name">
                    <span>{t.fullName}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {t.unreadCount > 0 ? <span className="msg-unread">{t.unreadCount}</span> : null}
                      <span style={{ fontSize: 11, color: '#A3AED0', fontWeight: 500 }}>{formatRelative(t.lastAt)}</span>
                    </span>
                  </div>
                  <div className="msg-thread-preview">{t.lastMessage || 'No messages yet'}</div>
                  {t.email ? <div style={{ fontSize: 11, color: '#A3AED0', marginTop: 2 }}>{t.email}</div> : null}
                </button>
              ))}
            </div>
          </section>

          <section className="msg-chat-panel" aria-label="Conversation">
            {!selectedFamilyId ? (
              <div className="msg-empty">
                <MessageCircle size={48} color="#E9EDF7" />
                <p style={{ marginTop: 16, fontWeight: 600 }}>Select a family user to view the conversation</p>
              </div>
            ) : (
              <>
                <header className="msg-chat-head">
                  <div className="msg-chat-avatar">
                    {(selectedThread?.fullName || 'F').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#1B2559' }}>{selectedThread?.fullName || 'Family user'}</div>
                    <div style={{ fontSize: 12, color: '#707EAE' }}>{selectedThread?.email || ''}</div>
                  </div>
                </header>
                <div className="msg-chat-body" ref={chatBodyRef}>
                  {messagesLoading && !messages.length && (
                    <div style={{ fontSize: 12, color: '#A3AED0' }}>Loading messages…</div>
                  )}
                  {!messagesLoading && !messages.length && (
                    <div style={{ fontSize: 13, color: '#A3AED0', textAlign: 'center', marginTop: 24 }}>
                      No messages yet. Send a greeting to start the conversation.
                    </div>
                  )}
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`msg-bubble ${msg.sender === 'user' ? 'in' : 'out'}`}
                    >
                      {msg.text}
                      {msg.time ? (
                        <div style={{ fontSize: 9, marginTop: 6, opacity: 0.65, textAlign: msg.sender === 'user' ? 'left' : 'right' }}>
                          {msg.time}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className="msg-chat-input">
                  <input
                    type="text"
                    placeholder="Type a reply…"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    disabled={sending}
                  />
                  <button type="button" className="msg-send-btn" onClick={handleSend} disabled={!inputValue.trim() || sending} aria-label="Send message">
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
