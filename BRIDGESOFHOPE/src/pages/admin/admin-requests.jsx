import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCheck } from 'lucide-react';
import {
  fetchStaffNotifications,
  markStaffNotificationRead,
  markAllStaffNotificationsRead,
  staffNotificationTargetPath,
  subscribeStaffNotifications,
} from '@/lib/staffNotifications';

const GROUP_ORDER = ['admission_request', 'discharge_request', 'visitation_request'];
const GROUP_LABELS = {
  admission_request: 'Admissions',
  discharge_request: 'Discharges',
  visitation_request: 'Visitations',
  other: 'Other',
};

/** Splits the flat notification list into titled sections (admissions / discharges / visitations). */
function groupNotifications(items) {
  const byType = new Map();
  items.forEach((item) => {
    const key = GROUP_ORDER.includes(item.related_type) ? item.related_type : 'other';
    if (!byType.has(key)) byType.set(key, []);
    byType.get(key).push(item);
  });
  return [...GROUP_ORDER, 'other']
    .filter((key) => byType.has(key))
    .map((key) => ({ key, label: GROUP_LABELS[key], items: byType.get(key) }));
}

function timeAgo(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Content-only — the outer sidebar/shell now lives in the Communications workspace
 * (communications.jsx), which mounts this as its "Requests" tab. Everything below is untouched
 * original logic. */
export function AdminRequestsContent() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const rows = await fetchStaffNotifications({ limit: 200 });
      setItems(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => subscribeStaffNotifications(() => void load()), [load]);

  const unreadCount = items.filter((i) => !i.read_at).length;
  const groups = groupNotifications(items);

  const openItem = async (item) => {
    if (!item.read_at) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read_at: new Date().toISOString() } : i)));
      void markStaffNotificationRead(item.id);
    }
    const path = staffNotificationTargetPath(item.related_type);
    if (path) navigate(path);
  };

  const handleMarkAllRead = async () => {
    setItems((prev) => prev.map((i) => (i.read_at ? i : { ...i, read_at: new Date().toISOString() })));
    await markAllStaffNotificationsRead();
  };

  return (
    <>
      <style>{`
        .req-icon-box { width: 40px; height: 40px; flex-shrink: 0; background: #FFF0ED; color: #F54E25; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .req-mark-btn { border: 1px solid #E2E8F0; background: white; color: #1B2559; border-radius: 10px; padding: 9px 16px; font-size: 12.5px; font-weight: 700; cursor: pointer; font-family: 'Inter', sans-serif; display: inline-flex; align-items: center; gap: 6px; }
        .req-mark-btn:hover { border-color: #CBD5E1; }
        .req-group { margin-bottom: 22px; }
        .req-group-label { font-size: 11px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: #A3AED0; margin-bottom: 10px; }
        .req-card { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; background: white; border: 1px solid #E9EDF7; border-radius: 14px; padding: 14px 16px; margin-bottom: 8px; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.02); transition: border-color 0.15s ease; }
        .req-card:hover { border-color: #CBD5E1; }
        .req-card-unread { background: #FFF7F4; border-color: #FFD9C7; }
        .req-card-title { font-size: 13.5px; font-weight: 800; color: #0F172A; }
        .req-card-body { font-size: 12.5px; color: #64748B; margin-top: 3px; line-height: 1.5; }
        .req-card-time { font-size: 11px; color: #94A3B8; font-weight: 600; margin-top: 6px; }
        .req-card-dot { width: 8px; height: 8px; border-radius: 999px; background: #F54E25; flex-shrink: 0; margin-top: 5px; }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <p style={{ fontSize: 13, color: '#707EAE', marginTop: 0, fontWeight: 500 }}>
            New guardian-submitted admission, discharge, and visitation requests.
          </p>
        </div>
        {unreadCount > 0 ? (
          <button type="button" className="req-mark-btn" onClick={handleMarkAllRead}>
            <CheckCheck size={14} />
            Mark all read
          </button>
        ) : null}
      </div>

      {loading ? (
        <p style={{ color: '#A3AED0', fontSize: 13 }}>Loading requests...</p>
      ) : items.length === 0 ? (
        <p style={{ color: '#A3AED0', fontSize: 13 }}>No requests yet.</p>
      ) : (
        groups.map((group) => (
          <div key={group.key} className="req-group">
            <div className="req-group-label">{group.label}</div>
            {group.items.map((item) => (
              <div
                key={item.id}
                className={`req-card${item.read_at ? '' : ' req-card-unread'}`}
                onClick={() => void openItem(item)}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="req-card-title">{item.title}</div>
                  <div className="req-card-body">{item.body}</div>
                  <div className="req-card-time">{timeAgo(item.created_at)}</div>
                </div>
                {!item.read_at ? <span className="req-card-dot" aria-hidden="true" /> : null}
              </div>
            ))}
          </div>
        ))
      )}
    </>
  );
}
