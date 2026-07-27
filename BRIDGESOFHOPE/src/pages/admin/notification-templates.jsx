import React, { useCallback, useEffect, useState } from 'react';
import { MessageSquare, RefreshCw, Save, Send, Users, User } from 'lucide-react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { familySidebarStyle } from '@/lib/familySidebarStyle';
import {
  fetchNotificationTemplates,
  updateNotificationTemplate,
  renderNotificationTemplate,
  fetchNotifiableFamilyProfiles,
  insertFamilyNotificationBroadcast,
  SENDABLE_NOTIFICATION_CATEGORIES,
} from '@/lib/notificationTemplates';

function familyDisplayName(profile) {
  const full = String(profile.full_name || '').trim();
  if (full) return full;
  const combined = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
  if (combined) return combined;
  return String(profile.login_email || profile.email || 'Unnamed guardian');
}

function SendNotificationCard() {
  const [families, setFamilies] = useState([]);
  const [loadingFamilies, setLoadingFamilies] = useState(true);
  const [category, setCategory] = useState(SENDABLE_NOTIFICATION_CATEGORIES[0].value);
  const [recipientMode, setRecipientMode] = useState('all'); // 'all' | 'specific'
  const [familyId, setFamilyId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetchNotifiableFamilyProfiles();
      if (cancelled) return;
      if (res.ok) {
        setFamilies(res.profiles);
        if (res.profiles[0]) setFamilyId(res.profiles[0].id);
      }
      setLoadingFamilies(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canSend = title.trim() && body.trim() && (recipientMode === 'all' || familyId) && !sending;

  const handleSend = async () => {
    setSending(true);
    setError('');
    setResult('');
    const res = await insertFamilyNotificationBroadcast({
      toAll: recipientMode === 'all',
      familyId: recipientMode === 'specific' ? familyId : undefined,
      category,
      title,
      body,
    });
    setSending(false);
    if (!res.ok) {
      setError(res.errorMessage);
      return;
    }
    setResult(res.sent === 1 ? 'Sent to 1 guardian.' : `Sent to ${res.sent} guardians.`);
    setTitle('');
    setBody('');
  };

  return (
    <div className="nt-card nt-send-card">
      <div className="nt-send-head">
        <Send size={18} />
        <div>
          <h2 className="nt-send-title">Send Notification</h2>
          <p className="nt-desc">Compose a promo, clinical concern, progress update, or general announcement and send it now.</p>
        </div>
      </div>

      <label className="nt-field-label" htmlFor="nt-send-category">Category</label>
      <select
        id="nt-send-category"
        className="nt-select"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      >
        {SENDABLE_NOTIFICATION_CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </select>

      <label className="nt-field-label" htmlFor="nt-send-title">Title</label>
      <input
        id="nt-send-title"
        className="nt-title-input nt-send-input"
        placeholder="e.g. New wellness program available"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <label className="nt-field-label" htmlFor="nt-send-body">Message</label>
      <textarea
        id="nt-send-body"
        className="nt-body-input"
        rows={3}
        placeholder="Write the notification content..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />

      <span className="nt-field-label">Recipients</span>
      <div className="nt-recipient-toggle">
        <button
          type="button"
          className={`nt-recipient-btn ${recipientMode === 'all' ? 'nt-recipient-btn-active' : ''}`}
          onClick={() => setRecipientMode('all')}
        >
          <Users size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
          All families
        </button>
        <button
          type="button"
          className={`nt-recipient-btn ${recipientMode === 'specific' ? 'nt-recipient-btn-active' : ''}`}
          onClick={() => setRecipientMode('specific')}
        >
          <User size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
          Specific family
        </button>
      </div>

      {recipientMode === 'specific' ? (
        <select
          className="nt-select"
          value={familyId}
          onChange={(e) => setFamilyId(e.target.value)}
          disabled={loadingFamilies}
        >
          {loadingFamilies ? (
            <option>Loading guardians...</option>
          ) : families.length === 0 ? (
            <option>No guardians found</option>
          ) : (
            families.map((f) => (
              <option key={f.id} value={f.id}>{familyDisplayName(f)}</option>
            ))
          )}
        </select>
      ) : null}

      {error ? <p className="nt-error">{error}</p> : null}
      {result ? <p className="nt-saved">{result}</p> : null}

      <button type="button" className="nt-save-btn nt-send-btn" onClick={handleSend} disabled={!canSend}>
        <Send size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
        {sending ? 'Sending...' : 'Send Notification'}
      </button>
    </div>
  );
}

/** Sample values so admins can preview rendered wording regardless of which placeholders a template uses. */
const SAMPLE_VARS = {
  patient_name: 'Juan Dela Cruz',
  meeting_date: '2026-08-01',
  meeting_time: '10:00 AM',
  notes: 'Valid ID, Medical Certificate',
  confirmed_date: '2026-08-03',
  confirmed_time: '2:00 PM',
  reason: 'Staff schedule conflict',
};

function TemplateCard({ template, onSaved }) {
  const [title, setTitle] = useState(template.title);
  const [body, setBody] = useState(template.body);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState(0);

  const dirty = title !== template.title || body !== template.body;

  const handleSave = async () => {
    setSaving(true);
    setError('');
    const res = await updateNotificationTemplate(template.id, { title, body });
    setSaving(false);
    if (!res.ok) {
      setError(res.errorMessage);
      return;
    }
    setSavedAt(Date.now());
    onSaved({ ...template, title, body });
  };

  return (
    <div className="nt-card">
      <div className="nt-card-head">
        <input
          className="nt-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <span className="nt-key">{template.template_key}</span>
      </div>
      {template.description ? <p className="nt-desc">{template.description}</p> : null}
      <textarea
        className="nt-body-input"
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="nt-preview">
        <span className="nt-preview-label">Preview</span>
        <p className="nt-preview-text">{renderNotificationTemplate(body, SAMPLE_VARS)}</p>
      </div>
      {error ? <p className="nt-error">{error}</p> : null}
      <div className="nt-card-foot">
        {savedAt && !dirty ? <span className="nt-saved">Saved</span> : <span />}
        <button type="button" className="nt-save-btn" onClick={handleSave} disabled={saving || !dirty}>
          <Save size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

export default function NotificationTemplatesPage() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await fetchNotificationTemplates({ force: true });
      if (!res.ok) {
        setErrorMessage(res.errorMessage);
        setTemplates([]);
      } else {
        setTemplates(res.templates);
      }
    } catch (e) {
      console.error(e);
      setErrorMessage(e.message || 'Failed to load notification templates.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const handleSaved = (updated) => {
    setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  return (
    <div
      className="family-portal admin-portal-layout nt-outer"
      style={{ display: 'flex', minHeight: '100vh', background: '#F8F9FD', fontFamily: "'Inter', sans-serif", color: '#1B2559', ...familySidebarStyle(isExpanded) }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        .nt-outer { width: 100%; overflow-x: clip; }
        .nt-main { flex: 0 0 auto; min-height: 100vh; padding: 24px; }
        .nt-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 16px; }
        .nt-card { background: white; border: 1px solid #E9EDF7; border-radius: 16px; padding: 18px; box-shadow: 0 4px 12px rgba(0,0,0,0.02); display: flex; flex-direction: column; gap: 10px; }
        .nt-card-head { display: flex; flex-direction: column; gap: 2px; }
        .nt-title-input { font-size: 14px; font-weight: 800; color: #0F172A; border: none; outline: none; padding: 2px 0; font-family: 'Inter', sans-serif; }
        .nt-title-input:focus { outline: 2px solid #2563EB; border-radius: 4px; }
        .nt-key { font-size: 11px; color: #A3AED0; font-weight: 600; }
        .nt-desc { font-size: 12px; color: #707EAE; margin: 0; }
        .nt-body-input { width: 100%; border: 1px solid #E9EDF7; border-radius: 10px; padding: 10px 12px; font-size: 13px; color: #1B2559; outline: none; background: white; font-family: 'Inter', sans-serif; resize: vertical; }
        .nt-body-input:focus { border-color: #2563EB; }
        .nt-preview { background: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 10px; padding: 10px 12px; }
        .nt-preview-label { font-size: 10px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.04em; }
        .nt-preview-text { margin: 4px 0 0; font-size: 13px; color: #334155; }
        .nt-error { color: #B91C1C; font-size: 12px; font-weight: 700; margin: 0; }
        .nt-card-foot { display: flex; justify-content: space-between; align-items: center; }
        .nt-saved { font-size: 11px; color: #059669; font-weight: 700; }
        .nt-save-btn { border: none; border-radius: 8px; padding: 7px 14px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: 'Inter', sans-serif; background: #F54E25; color: white; }
        .nt-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .nt-refresh-btn { border: none; border-radius: 8px; padding: 8px 14px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: 'Inter', sans-serif; background: white; color: #0F766E; border: 2px solid #0F766E; }
        .nt-send-card { max-width: 520px; margin-bottom: 24px; gap: 8px; }
        .nt-send-head { display: flex; align-items: flex-start; gap: 10px; color: #F54E25; }
        .nt-send-title { font-size: 16px; font-weight: 800; color: #0F172A; margin: 0; }
        .nt-field-label { font-size: 11px; font-weight: 700; color: #707EAE; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 6px; }
        .nt-send-input { width: 100%; border: 1px solid #E9EDF7; border-radius: 10px; padding: 9px 12px; }
        .nt-select { width: 100%; border: 1px solid #E9EDF7; border-radius: 10px; padding: 9px 12px; font-size: 13px; color: #1B2559; background: white; font-family: 'Inter', sans-serif; outline: none; }
        .nt-select:focus { border-color: #2563EB; }
        .nt-recipient-toggle { display: flex; gap: 8px; }
        .nt-recipient-btn { flex: 1; border: 2px solid #E9EDF7; background: white; border-radius: 10px; padding: 8px 10px; font-size: 12.5px; font-weight: 700; color: #707EAE; cursor: pointer; font-family: 'Inter', sans-serif; }
        .nt-recipient-btn-active { border-color: #F54E25; color: #C2410C; background: #FFF7ED; }
        .nt-send-btn { align-self: flex-start; }
        @media (max-width: 768px) { .desktop-sidebar { display: none !important; } .nt-main { padding: 20px 12px 100px 12px !important; } .nt-send-card { max-width: 100%; } }
      `}</style>

      <AdminSidebar isExpanded={isExpanded} onToggleExpanded={() => setIsExpanded(!isExpanded)} />

      <main className="nt-main admin-sidebar-offset">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#000', display: 'flex', alignItems: 'center', gap: 10 }}>
              <MessageSquare size={26} />
              Notification Templates
            </h1>
            <p style={{ fontSize: 13, color: '#707EAE', marginTop: 8, fontWeight: 500 }}>
              Wording sent to guardians for admission and visitation events. Edit the text below — placeholders in {'{{curly braces}}'} are filled in automatically.
            </p>
          </div>
          <button type="button" className="nt-refresh-btn" onClick={() => void loadTemplates()} disabled={loading}>
            <RefreshCw size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {errorMessage ? (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 12, padding: '10px 14px', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
            {errorMessage}
          </div>
        ) : null}

        <SendNotificationCard />

        {loading ? (
          <p style={{ color: '#A3AED0', fontSize: 13 }}>Loading templates...</p>
        ) : templates.length === 0 ? (
          <p style={{ color: '#A3AED0', fontSize: 13 }}>No templates found.</p>
        ) : (
          <div className="nt-grid">
            {templates.map((t) => (
              <TemplateCard key={t.id} template={t} onSaved={handleSaved} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
