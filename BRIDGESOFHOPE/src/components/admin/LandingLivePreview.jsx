import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { mergeSiteContent, SITE_CONTENT_STORAGE_KEY, SITE_CONTENT_EVENT } from '@/lib/siteContentStore';
import { mergeFacilitySettings, FACILITY_SETTINGS_STORAGE_KEY, FACILITY_SETTINGS_EVENT } from '@/lib/facilitySettings';

/**
 * Live preview iframe used inside the CMS. Toggles between the public Home page
 * (kept in sync with the CMS draft state) and the internal Admin Dashboard
 * (kept in sync with the Facility tab's draft state).
 * Writes merged JSON to the same localStorage key the target page reads, then
 * notifies the iframe window so its React tree reloads from storage.
 */
export default function LandingLivePreview({ content, facilitySettings, onSectionSelect, onIframeRef }) {
  const iframeRef = useRef(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [mode, setMode] = useState('home'); // 'home' | 'dashboard'

  const setIframeRef = useCallback(
    (node) => {
      iframeRef.current = node;
      if (typeof onIframeRef === 'function') {
        onIframeRef(node);
      }
    },
    [onIframeRef],
  );

  useEffect(() => {
    if (!onSectionSelect) return undefined;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const handler = (e) => {
      if (!origin || e.origin !== origin) return;
      if (e.data?.type === 'cms-select-section' && typeof e.data.sectionId === 'string') {
        onSectionSelect(e.data.sectionId);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onSectionSelect]);

  const pushToPreview = useCallback(() => {
    try {
      const w = iframeRef.current?.contentWindow;
      if (!w) return;
      if (mode === 'dashboard') {
        const next = mergeFacilitySettings(facilitySettings);
        localStorage.setItem(FACILITY_SETTINGS_STORAGE_KEY, JSON.stringify(next));
        w.dispatchEvent(new CustomEvent(FACILITY_SETTINGS_EVENT));
      } else {
        const next = mergeSiteContent(content);
        localStorage.setItem(SITE_CONTENT_STORAGE_KEY, JSON.stringify(next));
        w.dispatchEvent(new CustomEvent(SITE_CONTENT_EVENT));
      }
    } catch {
      /* ignore */
    }
  }, [content, facilitySettings, mode]);

  useEffect(() => {
    const id = setTimeout(pushToPreview, 380);
    return () => clearTimeout(id);
  }, [pushToPreview]);

  const handleIframeLoad = useCallback(() => {
    pushToPreview();
  }, [pushToPreview]);

  const hardReload = useCallback(() => {
    setReloadToken((k) => k + 1);
  }, []);

  const path = mode === 'dashboard' ? '/admin-dashboard' : '/?cmsEdit=1';
  const src = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;

  return (
    <div className="cm-preview-wrap">
      <div className="cm-preview-toolbar">
        <span>
          <strong style={{ color: '#1B2559' }}>Preview</strong>
          <span style={{ fontWeight: 500, color: '#94a3b8', marginLeft: 8 }}>
            {mode === 'dashboard' ? 'Admin dashboard · updates as you edit' : 'Home · updates as you edit'}
          </span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="cm-preview-toggle" role="tablist" aria-label="Preview target">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'home'}
              className={`cm-preview-toggle-btn${mode === 'home' ? ' cm-preview-toggle-btn--active' : ''}`}
              onClick={() => setMode('home')}
            >
              Home
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'dashboard'}
              className={`cm-preview-toggle-btn${mode === 'dashboard' ? ' cm-preview-toggle-btn--active' : ''}`}
              onClick={() => setMode('dashboard')}
            >
              Admin dashboard
            </button>
          </div>
          <button type="button" className="cm-btn cm-btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={hardReload} title="Reload preview">
            <RefreshCw size={14} /> Reload
          </button>
        </div>
      </div>
      <div className="cm-preview-frame">
        <iframe
          key={`${reloadToken}-${mode}`}
          ref={setIframeRef}
          title={mode === 'dashboard' ? 'Admin dashboard — live preview' : 'Landing page — live preview'}
          src={src}
          onLoad={handleIframeLoad}
        />
      </div>
    </div>
  );
}
