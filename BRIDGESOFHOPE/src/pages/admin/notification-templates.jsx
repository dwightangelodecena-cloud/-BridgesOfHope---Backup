import React, { useCallback, useEffect, useState } from 'react';
import { MessageSquare, RefreshCw, Save } from 'lucide-react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { familySidebarStyle } from '@/lib/familySidebarStyle';
import {
  fetchNotificationTemplates,
  updateNotificationTemplate,
  renderNotificationTemplate,
} from '@/lib/notificationTemplates';

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
        @media (max-width: 768px) { .desktop-sidebar { display: none !important; } .nt-main { padding: 20px 12px 100px 12px !important; } }
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
