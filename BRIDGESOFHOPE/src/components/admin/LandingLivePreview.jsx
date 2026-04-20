import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { mergeSiteContent, SITE_CONTENT_STORAGE_KEY, SITE_CONTENT_EVENT } from '@/lib/siteContentStore';

/**
 * Full public home page in an iframe, kept in sync with the CMS draft state.
 * Writes merged JSON to the same localStorage key the live site reads, then
 * notifies the iframe window so the landing page React tree reloads from storage.
 */
export default function LandingLivePreview({ content, onSectionSelect, onIframeRef }) {
  const iframeRef = useRef(null);
  const [reloadToken, setReloadToken] = useState(0);

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
      const next = mergeSiteContent(content);
      localStorage.setItem(SITE_CONTENT_STORAGE_KEY, JSON.stringify(next));
      const w = iframeRef.current?.contentWindow;
      if (w) {
        w.dispatchEvent(new CustomEvent(SITE_CONTENT_EVENT));
      }
    } catch {
      /* ignore */
    }
  }, [content]);

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

  const src = typeof window !== 'undefined' ? `${window.location.origin}/?cmsEdit=1` : '/?cmsEdit=1';

  return (
    <div className="cm-preview-wrap">
      <div className="cm-preview-toolbar">
        <span>
          <strong style={{ color: '#1B2559' }}>Preview</strong>
          <span style={{ fontWeight: 500, color: '#94a3b8', marginLeft: 8 }}>Home · updates as you edit</span>
        </span>
        <button type="button" className="cm-btn cm-btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={hardReload} title="Reload preview">
          <RefreshCw size={14} /> Reload
        </button>
      </div>
      <div className="cm-preview-frame">
        <iframe
          key={reloadToken}
          ref={setIframeRef}
          title="Landing page — live preview"
          src={src}
          onLoad={handleIframeLoad}
        />
      </div>
    </div>
  );
}
