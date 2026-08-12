import React, { useCallback, useEffect, useState } from 'react';
import { Megaphone, Plus, Pencil, Trash2, X, ImagePlus } from 'lucide-react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { familySidebarStyle } from '@/lib/familySidebarStyle';
import CmsImageField from '@/components/admin/CmsImageField';
import {
  fetchAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  publishAnnouncement,
  checkAndSendDueAnnouncementNotifications,
  deriveAnnouncementDisplayStatus,
} from '@/lib/announcements';

const STATUS_BADGE = {
  draft: { label: 'Draft', bg: '#F1F5F9', color: '#475569', border: '#E2E8F0' },
  scheduled: { label: 'Scheduled', bg: '#EEF2FF', color: '#3730A3', border: '#C7D2FE' },
  live: { label: 'Live', bg: '#DCFCE7', color: '#166534', border: '#BBF7D0' },
  expired: { label: 'Expired', bg: '#FEF2F2', color: '#991B1B', border: '#FECACA' },
};

function formatDateRange(showFrom, hideAfter) {
  const fmt = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };
  const from = fmt(showFrom);
  const to = fmt(hideAfter);
  if (!from && !to) return 'No schedule set';
  if (from && to) return `${from} → ${to}`;
  if (from) return `From ${from}`;
  return `Until ${to}`;
}

/** ISO string <-> the local-time value <input type="datetime-local"> needs, and back. */
function isoToLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToIso(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Mirrors AnnouncementPopup.tsx's premium-card look, so the admin sees what the family app will show. */
function AnnouncementPreviewCard({ title, caption, imageUrl }) {
  return (
    <div className="an-preview-card">
      <div className="an-preview-image-wrap">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="an-preview-image" />
        ) : (
          <div className="an-preview-image-placeholder">
            <ImagePlus size={22} />
          </div>
        )}
        <span className="an-preview-pill">Announcement</span>
      </div>
      <div className="an-preview-body">
        <div className="an-preview-title">{title?.trim() || 'Announcement title'}</div>
        <div className="an-preview-caption">{caption?.trim() || 'Your caption will appear here.'}</div>
        <button type="button" className="an-preview-btn" disabled>Got it</button>
        <div className="an-preview-dots">
          <span className="an-preview-dot an-preview-dot-active" />
        </div>
      </div>
    </div>
  );
}

function AnnouncementComposerModal({ initial, onClose, onSaved }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [caption, setCaption] = useState(initial?.caption || '');
  const [imageUrl, setImageUrl] = useState(initial?.image_url || '');
  const [showFrom, setShowFrom] = useState(isoToLocalInput(initial?.show_from));
  const [hideAfter, setHideAfter] = useState(isoToLocalInput(initial?.hide_after));
  const [notifyOnPublish, setNotifyOnPublish] = useState(initial?.notify_on_publish !== false);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');

  const isEdit = Boolean(initial?.id);
  const wasPublished = initial?.status === 'published';

  const buildPatch = () => ({
    title,
    caption,
    imageUrl,
    showFrom: localInputToIso(showFrom),
    hideAfter: localInputToIso(hideAfter),
    notifyOnPublish,
  });

  const handleSaveDraft = async () => {
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    setSaving('draft');
    setError('');
    const patch = buildPatch();
    const res = isEdit
      ? await updateAnnouncement(initial.id, { ...patch, status: 'draft' })
      : await createAnnouncement({ ...patch, status: 'draft' });
    setSaving('');
    if (!res.ok) {
      setError(res.errorMessage);
      return;
    }
    onSaved();
  };

  const handlePublish = async () => {
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    setSaving('publish');
    setError('');
    const patch = buildPatch();
    const saveRes = isEdit
      ? await updateAnnouncement(initial.id, patch)
      : await createAnnouncement({ ...patch, status: 'draft' });
    if (!saveRes.ok) {
      setSaving('');
      setError(saveRes.errorMessage);
      return;
    }
    const targetId = isEdit ? initial.id : saveRes.announcement.id;
    // Editing an already-published announcement doesn't need to re-run the publish transition —
    // notified_at already governs whether it re-notifies (it won't), so a plain save is enough.
    const publishRes = wasPublished ? { ok: true } : await publishAnnouncement(targetId);
    setSaving('');
    if (!publishRes.ok) {
      setError(publishRes.errorMessage);
      return;
    }
    onSaved();
  };

  return (
    <div className="an-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="an-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="an-modal-head">
          <div>
            <div className="an-modal-title">{isEdit ? 'Edit Announcement' : 'New Announcement'}</div>
            <div className="an-modal-sub">Family / Mobile App audience</div>
          </div>
          <button type="button" className="an-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="an-modal-body">
          <div className="an-modal-form">
            <label className="an-field-label" htmlFor="an-title">Title</label>
            <input
              id="an-title"
              className="an-input"
              placeholder="e.g. Local Recruitment Activity — July 28"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <label className="an-field-label" htmlFor="an-caption">Caption (optional)</label>
            <textarea
              id="an-caption"
              className="an-textarea"
              rows={3}
              placeholder="Interested and qualified applicants are encouraged to attend..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />

            <CmsImageField
              label="Pubmat Image"
              hint="Uploaded to the same media library used across the site."
              value={imageUrl}
              onChange={setImageUrl}
            />

            <div className="an-date-row">
              <div>
                <label className="an-field-label" htmlFor="an-show-from">Show from (optional)</label>
                <input
                  id="an-show-from"
                  type="datetime-local"
                  className="an-input"
                  value={showFrom}
                  onChange={(e) => setShowFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="an-field-label" htmlFor="an-hide-after">Hide after (optional)</label>
                <input
                  id="an-hide-after"
                  type="datetime-local"
                  className="an-input"
                  value={hideAfter}
                  onChange={(e) => setHideAfter(e.target.value)}
                />
              </div>
            </div>
            <p className="an-hint">
              Leave dates blank to show as soon as it&apos;s published until you remove it. A future
              &quot;Show from&quot; keeps it Scheduled — it only goes Live (and only then notifies) once that time arrives.
            </p>

            <label className="an-checkbox-row" htmlFor="an-notify">
              <input
                id="an-notify"
                type="checkbox"
                checked={notifyOnPublish}
                onChange={(e) => setNotifyOnPublish(e.target.checked)}
              />
              Notify guardians when it goes live
            </label>

            {error ? <p className="an-error">{error}</p> : null}
          </div>

          <div className="an-modal-preview-col">
            <span className="an-field-label">App preview</span>
            <AnnouncementPreviewCard title={title} caption={caption} imageUrl={imageUrl} />
          </div>
        </div>

        <div className="an-modal-foot">
          <button type="button" className="an-btn an-btn-ghost" onClick={onClose} disabled={Boolean(saving)}>
            Cancel
          </button>
          <button type="button" className="an-btn an-btn-outline" onClick={handleSaveDraft} disabled={Boolean(saving)}>
            {saving === 'draft' ? 'Saving...' : 'Save as Draft'}
          </button>
          <button type="button" className="an-btn an-btn-primary" onClick={handlePublish} disabled={Boolean(saving)}>
            {saving === 'publish' ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminAnnouncementsPage() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await fetchAnnouncements();
      if (!res.ok) {
        setErrorMessage(res.errorMessage);
        setAnnouncements([]);
      } else {
        setAnnouncements(res.announcements);
      }
      // Opportunistic catch-up: fires the guardian broadcast for any announcement whose
      // scheduled show_from has passed since the last time an admin had this page open.
      // Never touches status/show_from/hide_after — visibility is governed by RLS alone.
      void checkAndSendDueAnnouncementNotifications();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onFocus = () => void load();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void load();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [load]);

  const openNew = () => {
    setEditingRow(null);
    setComposerOpen(true);
  };
  const openEdit = (row) => {
    setEditingRow(row);
    setComposerOpen(true);
  };
  const closeComposer = () => {
    setComposerOpen(false);
    setEditingRow(null);
  };
  const handleSaved = () => {
    closeComposer();
    void load();
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete "${row.title}"? This can't be undone.`)) return;
    const res = await deleteAnnouncement(row.id);
    if (!res.ok) {
      window.alert(res.errorMessage);
      return;
    }
    void load();
  };

  return (
    <div
      className="family-portal admin-portal-layout an-outer"
      style={{ display: 'flex', minHeight: '100vh', background: '#F8F9FD', fontFamily: "'Inter', sans-serif", color: '#1B2559', ...familySidebarStyle(isExpanded) }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        .an-outer { width: 100%; overflow-x: clip; }
        .an-main { flex: 0 0 auto; min-height: 100vh; padding: 24px; }
        .an-icon-box { width: 40px; height: 40px; flex-shrink: 0; background: #FFF0ED; color: #F54E25; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .an-new-btn { border: none; border-radius: 10px; padding: 10px 16px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: 'Inter', sans-serif; background: #F54E25; color: white; display: inline-flex; align-items: center; gap: 6px; }
        .an-error-banner { background: #FEF2F2; border: 1px solid #FECACA; color: #B91C1C; border-radius: 12px; padding: 10px 14px; font-size: 13px; font-weight: 600; margin-bottom: 16px; }
        .an-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
        .an-card { background: white; border: 1px solid #E9EDF7; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.02); display: flex; flex-direction: column; }
        .an-card-thumb { width: 100%; height: 130px; object-fit: cover; background: #F1F5F9; display: block; }
        .an-card-thumb-placeholder { width: 100%; height: 130px; background: #F1F5F9; display: flex; align-items: center; justify-content: center; color: #CBD5E1; }
        .an-card-body { padding: 14px; display: flex; flex-direction: column; gap: 6px; flex: 1; }
        .an-card-head-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .an-card-title { font-size: 14px; font-weight: 800; color: #0F172A; margin: 0; }
        .an-badge { font-size: 10px; font-weight: 800; border-radius: 999px; padding: 3px 9px; flex-shrink: 0; border: 1px solid transparent; text-transform: uppercase; letter-spacing: 0.03em; }
        .an-card-caption { font-size: 12px; color: #64748B; margin: 0; line-height: 1.5; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .an-card-window { font-size: 11px; color: #94A3B8; font-weight: 600; margin-top: 2px; }
        .an-card-actions { display: flex; gap: 8px; margin-top: 8px; }
        .an-icon-btn { border: 1px solid #E9EDF7; background: white; border-radius: 8px; width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; color: #475569; }
        .an-icon-btn:hover { border-color: #CBD5E1; }
        .an-icon-btn-danger { color: #B91C1C; }

        .an-modal-backdrop { position: fixed; inset: 0; z-index: 2000; background: rgba(15,23,42,0.45); display: flex; align-items: center; justify-content: center; padding: 20px; }
        .an-modal { width: min(100%, 920px); max-height: min(90vh, 720px); overflow: hidden; display: flex; flex-direction: column; background: #fff; border-radius: 18px; border: 1px solid #e2e8f0; box-shadow: 0 24px 48px rgba(15,23,42,0.18); }
        .an-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 18px 20px 14px; border-bottom: 1px solid #f1f5f9; }
        .an-modal-title { font-size: 16px; font-weight: 900; color: #0f172a; }
        .an-modal-sub { font-size: 12px; font-weight: 700; color: #94a3b8; margin-top: 3px; }
        .an-modal-close { border: 1px solid #e2e8f0; background: #f8fafc; color: #1B2559; width: 34px; height: 34px; border-radius: 10px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .an-modal-close:hover { background: #f1f5f9; }
        .an-modal-body { display: flex; gap: 20px; padding: 18px 20px; overflow-y: auto; flex: 1; }
        .an-modal-form { flex: 1 1 55%; min-width: 260px; display: flex; flex-direction: column; }
        .an-modal-preview-col { flex: 1 1 40%; min-width: 220px; display: flex; flex-direction: column; gap: 8px; }
        .an-field-label { font-size: 11px; font-weight: 700; color: #707EAE; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 12px; margin-bottom: 6px; display: block; }
        .an-input { width: 100%; border: 1px solid #E9EDF7; border-radius: 10px; padding: 10px 12px; font-size: 13px; color: #1B2559; outline: none; background: white; font-family: 'Inter', sans-serif; }
        .an-input:focus { border-color: #2563EB; }
        .an-textarea { width: 100%; border: 1px solid #E9EDF7; border-radius: 10px; padding: 10px 12px; font-size: 13px; color: #1B2559; outline: none; background: white; font-family: 'Inter', sans-serif; resize: vertical; }
        .an-textarea:focus { border-color: #2563EB; }
        .an-date-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .an-hint { font-size: 11px; color: #94A3B8; margin: 8px 0 0; line-height: 1.5; }
        .an-checkbox-row { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: #334155; margin-top: 16px; cursor: pointer; }
        .an-error { color: #B91C1C; font-size: 12px; font-weight: 700; margin: 10px 0 0; }
        .an-modal-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 20px 18px; border-top: 1px solid #f1f5f9; }
        .an-btn { border-radius: 10px; padding: 10px 18px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: 'Inter', sans-serif; border: 1px solid transparent; }
        .an-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .an-btn-ghost { background: white; color: #64748B; border-color: #E2E8F0; }
        .an-btn-outline { background: white; color: #1B2559; border-color: #CBD5E1; }
        .an-btn-primary { background: #F54E25; color: white; }

        .an-preview-card { border-radius: 18px; overflow: hidden; border: 1px solid #E9EDF7; background: #fff; box-shadow: 0 10px 24px rgba(15,23,42,0.08); }
        .an-preview-image-wrap { position: relative; width: 100%; height: 140px; background: linear-gradient(135deg, #FF8A3D 0%, #F5761E 30%, #F54E25 65%, #EA3E12 100%); }
        .an-preview-image { width: 100%; height: 100%; object-fit: cover; display: block; }
        .an-preview-image-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.75); }
        .an-preview-pill { position: absolute; left: 14px; bottom: -12px; background: linear-gradient(135deg, #FF8A3D 0%, #F5761E 30%, #F54E25 65%, #EA3E12 100%); color: white; font-size: 10.5px; font-weight: 800; padding: 5px 12px; border-radius: 999px; box-shadow: 0 6px 14px rgba(245,78,37,0.35); text-transform: uppercase; letter-spacing: 0.03em; }
        .an-preview-body { padding: 22px 16px 16px; }
        .an-preview-title { font-size: 16px; font-weight: 900; color: #0F172A; margin-bottom: 6px; }
        .an-preview-caption { font-size: 12.5px; color: #64748B; line-height: 1.55; margin-bottom: 16px; }
        .an-preview-btn { width: 100%; border: none; border-radius: 12px; padding: 11px; font-size: 13px; font-weight: 800; color: white; background: #F54E25; font-family: 'Inter', sans-serif; }
        .an-preview-dots { display: flex; justify-content: center; gap: 5px; margin-top: 12px; }
        .an-preview-dot { width: 6px; height: 6px; border-radius: 999px; background: #E2E8F0; }
        .an-preview-dot-active { background: #F54E25; width: 16px; }

        @media (max-width: 899px) { .desktop-sidebar { display: none !important; } .an-main { padding: 20px 12px 100px 12px !important; } }
        @media (max-width: 720px) { .an-modal-body { flex-direction: column; } }
      `}</style>

      <AdminSidebar isExpanded={isExpanded} onToggleExpanded={() => setIsExpanded(!isExpanded)} />

      <main className="an-main admin-sidebar-offset">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="an-icon-box"><Megaphone size={20} /></span>
              Announcements
            </h1>
            <p style={{ fontSize: 13, color: '#707EAE', marginTop: 8, fontWeight: 500 }}>
              Promotional announcements shown as a popup on the family mobile app. Audience is always Family / Mobile App users.
            </p>
          </div>
          <button type="button" className="an-new-btn" onClick={openNew}>
            <Plus size={15} />
            New Announcement
          </button>
        </div>

        {errorMessage ? <div className="an-error-banner">{errorMessage}</div> : null}

        {loading ? (
          <p style={{ color: '#A3AED0', fontSize: 13 }}>Loading announcements...</p>
        ) : announcements.length === 0 ? (
          <p style={{ color: '#A3AED0', fontSize: 13 }}>No announcements yet. Click &quot;New Announcement&quot; to create one.</p>
        ) : (
          <div className="an-grid">
            {announcements.map((row) => {
              const displayStatus = deriveAnnouncementDisplayStatus(row);
              const badge = STATUS_BADGE[displayStatus];
              return (
                <div key={row.id} className="an-card">
                  {row.image_url ? (
                    <img src={row.image_url} alt="" className="an-card-thumb" />
                  ) : (
                    <div className="an-card-thumb-placeholder"><ImagePlus size={24} /></div>
                  )}
                  <div className="an-card-body">
                    <div className="an-card-head-row">
                      <p className="an-card-title">{row.title}</p>
                      <span
                        className="an-badge"
                        style={{ background: badge.bg, color: badge.color, borderColor: badge.border }}
                      >
                        {badge.label}
                      </span>
                    </div>
                    {row.caption ? <p className="an-card-caption">{row.caption}</p> : null}
                    <span className="an-card-window">{formatDateRange(row.show_from, row.hide_after)}</span>
                    <div className="an-card-actions">
                      <button type="button" className="an-icon-btn" onClick={() => openEdit(row)} title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button type="button" className="an-icon-btn an-icon-btn-danger" onClick={() => handleDelete(row)} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {composerOpen ? (
        <AnnouncementComposerModal initial={editingRow} onClose={closeComposer} onSaved={handleSaved} />
      ) : null}
    </div>
  );
}
