import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutGrid,
  HeartPulse,
  BookUser,
  Users,
  LogOut,
  ClipboardList,
  ArrowRightSquare,
  Stethoscope,
  LayoutTemplate,
  Save,
  RotateCcw,
  ExternalLink,
  GripVertical,
  Rows3,
  Palette,
  Menu,
  PanelLeft,
  Layers,
  ChevronLeft,
  ChevronRight,
  PanelRight,
  Calendar,
  User,
  FileText,
  Construction,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logoBH from '@/assets/kalingalogo.png';
import {
  loadSiteContent,
  saveMergedSiteContent,
  resetSiteContent,
  SITE_CONTENT_EVENT,
  PROBLEM_ICON_KEYS,
  LANDING_SECTION_LABELS,
  normalizeSectionOrder,
} from '@/lib/siteContentStore';
import { pullSiteContentFromSupabase, pushSiteContentToSupabase } from '@/lib/siteContentRemote';
import {
  DEFAULT_CMS_MAINTENANCE_MESSAGE,
  setCmsMaintenanceRemote,
} from '@/lib/cmsMaintenance';
import { buildCustomBlock } from '@/lib/customBlockFactory';
import { SortableRow, SortableVerticalList } from '@/components/admin/CmsSortable';
import CustomBlocksVisualEditor from '@/components/admin/CustomBlocksVisualEditor';
import LandingLivePreview from '@/components/admin/LandingLivePreview';
import CmsImageField from '@/components/admin/CmsImageField';

const TABS = [
  { id: 'order', label: 'Page order' },
  { id: 'theme', label: 'Theme & layout' },
  { id: 'nav', label: 'Navigation' },
  { id: 'hero', label: 'Hero' },
  { id: 'problem', label: 'Challenge' },
  { id: 'services', label: 'Services' },
  { id: 'proof', label: 'Proof' },
  { id: 'testimonials', label: 'Stories' },
  { id: 'about', label: 'About' },
  { id: 'faq', label: 'FAQ' },
  { id: 'footer', label: 'CTA & footer' },
  { id: 'elements', label: 'Elements' },
];

const SECTION_TAB_ORDER = ['hero', 'problem', 'services', 'proof', 'testimonials', 'about', 'faq', 'footer'];
const SECTION_TABS = SECTION_TAB_ORDER.map((id) => TABS.find((t) => t.id === id)).filter(Boolean);

const EDITOR_RAIL = [
  { id: 'structure', tab: 'order', label: 'Page structure', title: 'Reorder sections', Icon: Rows3 },
  { id: 'blocks', tab: 'elements', label: 'Elements', title: 'Drag onto live page', Icon: Layers },
  { id: 'design', tab: 'theme', label: 'Site design', title: 'Colors & type', Icon: Palette },
  { id: 'sections', tab: null, label: 'Sections', title: 'Hero, FAQ, …', Icon: PanelLeft },
  { id: 'menu', tab: 'nav', label: 'Menu', title: 'Navigation', Icon: Menu },
];

function tabToRailId(tab) {
  if (tab === 'order') return 'structure';
  if (tab === 'theme') return 'design';
  if (tab === 'nav') return 'menu';
  if (tab === 'elements') return 'blocks';
  if (SECTION_TAB_ORDER.includes(tab)) return 'sections';
  return 'design';
}

/** One short line under the drawer title — keeps the panel calmer than long tutorial cards. */
function drawerHintLine(activeRailId, tab, setTab) {
  if (activeRailId === 'structure') {
    return 'Reorder main sections. Save syncs to Supabase (when configured) and this browser.';
  }
  if (activeRailId === 'design') {
    return 'Global theme (CSS variables). Save to apply on the live site.';
  }
  if (activeRailId === 'menu') {
    return 'Section IDs should match anchors on the page (e.g. services, faq).';
  }
  if (activeRailId === 'sections') {
    const t = SECTION_TABS.find((x) => x.id === tab);
    return (
      <span>
        Copy for <strong>{t?.label ?? 'section'}</strong>. Site-wide look:{' '}
        <button
          type="button"
          onClick={() => setTab('theme')}
          style={{ border: 'none', background: 'none', padding: 0, color: '#F54E25', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', font: 'inherit' }}
        >
          Site design
        </button>
        . Extra layout blocks:{' '}
        <button
          type="button"
          onClick={() => setTab('elements')}
          style={{ border: 'none', background: 'none', padding: 0, color: '#F54E25', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', font: 'inherit' }}
        >
          Elements
        </button>
        .
      </span>
    );
  }
  return null;
}

const FIELD = { marginBottom: 14 };
const LABEL = { fontSize: 12, fontWeight: 700, color: '#707EAE', display: 'block', marginBottom: 6 };
const INPUT = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #E9EDF7',
  borderRadius: 10,
  fontSize: 13,
  fontFamily: 'Inter, sans-serif',
};

/** Same order as `proof.pressOutlets` / press row on the home page. */
const PRESS_OUTLET_LABELS = [
  'GMA News TV',
  'TV5',
  'The Wall Street Journal',
  'VICE News',
  'Rappler',
  'TV5 Reaksyon',
];

/**
 * Logo height (px): edits a local draft while focused so typing "50" does not jump to 12 on "5".
 * Clamps 12–maxPx on blur. Uses text + inputMode (no number spinners).
 */
function BrandingLogoPxInput({ label, path, valuePx, maxPx, placeholder, setField }) {
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(valuePx > 0 ? String(valuePx) : '');
    }
  }, [valuePx, focused]);

  const display = focused ? draft : valuePx > 0 ? String(valuePx) : '';

  const commit = (raw) => {
    const t = String(raw).replace(/[^\d]/g, '').trim();
    if (t === '') {
      setField(path, 0);
      return;
    }
    const n = Number.parseInt(t, 10);
    if (!Number.isFinite(n) || n <= 0) {
      setField(path, 0);
      return;
    }
    setField(path, Math.min(maxPx, Math.max(12, n)));
  };

  return (
    <div style={FIELD}>
      <label style={LABEL}>{label}</label>
      <input
        style={INPUT}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={display}
        onFocus={() => {
          setFocused(true);
          setDraft(valuePx > 0 ? String(valuePx) : '');
        }}
        onChange={(e) => {
          setDraft(e.target.value.replace(/[^\d]/g, ''));
        }}
        onBlur={(e) => {
          setFocused(false);
          commit(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </div>
  );
}

function ContentManagement() {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [content, setContent] = useState(() => loadSiteContent());
  const [tab, setTab] = useState('order');
  const [propsPanelOpen, setPropsPanelOpen] = useState(true);
  const [savedMsg, setSavedMsg] = useState('');
  const [err, setErr] = useState('');
  /** While true, the public home page shows a full-screen maintenance overlay for visitors. */
  const [publicMaint, setPublicMaint] = useState(true);
  const [maintSyncErr, setMaintSyncErr] = useState('');

  const normalizedSectionOrder = useMemo(
    () => normalizeSectionOrder(content.sectionOrder),
    [content.sectionOrder],
  );

  const sync = useCallback(() => {
    setContent(loadSiteContent());
  }, []);

  useEffect(() => {
    window.addEventListener(SITE_CONTENT_EVENT, sync);
    return () => window.removeEventListener(SITE_CONTENT_EVENT, sync);
  }, [sync]);

  /** Stop wheel/trackpad scroll from chaining to the document (which moved the preview iframe). Desktop only so narrow layouts can still scroll the page if needed. */
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 901px)');
    const html = document.documentElement;
    const body = document.body;
    const apply = () => {
      if (mq.matches) {
        html.style.overflow = 'hidden';
        body.style.overflow = 'hidden';
      } else {
        html.style.overflow = '';
        body.style.overflow = '';
      }
    };
    apply();
    mq.addEventListener('change', apply);
    return () => {
      mq.removeEventListener('change', apply);
      html.style.overflow = '';
      body.style.overflow = '';
    };
  }, []);

  /** Hydrate editor from Supabase when a row exists (admin session not required for read). */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const merged = await pullSiteContentFromSupabase();
      if (cancelled || !merged) return;
      saveMergedSiteContent(merged);
      setContent(loadSiteContent());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void setCmsMaintenanceRemote(publicMaint, DEFAULT_CMS_MAINTENANCE_MESSAGE).then((r) => {
      if (cancelled) return;
      setMaintSyncErr(r.ok ? '' : r.error || 'Could not sync public maintenance mode.');
    });
    return () => {
      cancelled = true;
      void setCmsMaintenanceRemote(false);
    };
  }, [publicMaint]);

  const handleSave = async () => {
    setErr('');
    try {
      saveMergedSiteContent(content);
      const merged = loadSiteContent();
      const remote = await pushSiteContentToSupabase(merged);
      if (remote.skipped) {
        setSavedMsg('Saved locally. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env for cloud sync.');
      } else if (!remote.ok) {
        setErr(remote.error || 'Cloud save failed. Saved locally only.');
        setSavedMsg('');
        return;
      } else {
        setSavedMsg('CMS saved: Supabase updated. Other tabs pick up local storage.');
      }
      setTimeout(() => setSavedMsg(''), 4000);
    } catch (e) {
      setErr(e?.message || 'Could not save.');
    }
  };

  const handleReset = () => {
    if (!window.confirm('Reset all landing page content to factory defaults?')) return;
    resetSiteContent();
    setContent(loadSiteContent());
    setSavedMsg('Reset to defaults.');
    setTimeout(() => setSavedMsg(''), 3000);
  };

  const set = (path, value) => {
    setContent((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const parts = path.split('.');
      let cur = next;
      for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i];
        if (cur[p] == null) cur[p] = {};
        cur = cur[p];
      }
      cur[parts[parts.length - 1]] = value;
      return next;
    });
  };

  const customSections = useMemo(() => content.customSections || [], [content.customSections]);

  const patchCustomBlock = useCallback((id, partial) => {
    setContent((prev) => ({
      ...prev,
      customSections: (prev.customSections || []).map((b) => (b.id === id ? { ...b, ...partial } : b)),
    }));
  }, []);

  const insertCustomBlockAt = useCallback((type, index) => {
    setContent((prev) => {
      const sorted = [...(prev.customSections || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const id = `cs-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const at = Math.min(Math.max(0, index), sorted.length);
      const block = buildCustomBlock(type, id, at);
      sorted.splice(at, 0, block);
      sorted.forEach((b, i) => {
        b.order = i;
      });
      return { ...prev, customSections: sorted };
    });
  }, []);

  const reorderCustomBlocks = useCallback((newIds) => {
    setContent((prev) => {
      const map = new Map((prev.customSections || []).map((b) => [b.id, { ...b }]));
      const next = newIds.map((id) => map.get(id)).filter(Boolean);
      next.forEach((b, i) => {
        b.order = i;
      });
      return { ...prev, customSections: next };
    });
  }, []);

  const removeCustomBlock = (id) => {
    setContent((prev) => ({
      ...prev,
      customSections: (prev.customSections || []).filter((b) => b.id !== id),
    }));
  };

  const activeRailId = tabToRailId(tab);
  const drawerHint = drawerHintLine(activeRailId, tab, setTab);

  const selectRail = useCallback((railId) => {
    const entry = EDITOR_RAIL.find((r) => r.id === railId);
    if (!entry) return;
    if (entry.tab) setTab(entry.tab);
    else if (railId === 'sections') setTab((prev) => (SECTION_TAB_ORDER.includes(prev) ? prev : 'hero'));
    setPropsPanelOpen(true);
  }, []);

  const handlePreviewSectionSelect = useCallback(
    (sectionId) => {
      setPropsPanelOpen(true);
      if (sectionId === 'custom') {
        selectRail('blocks');
        return;
      }
      const nextTab = sectionId === 'cta' ? 'footer' : sectionId;
      if (SECTION_TAB_ORDER.includes(nextTab)) {
        setTab(nextTab);
        selectRail('sections');
      }
    },
    [selectRail]
  );

  return (
    <div
      className="cm-outer"
      style={{ display: 'flex', minHeight: '100vh', background: '#F8F9FD', fontFamily: "'Inter', sans-serif", color: '#1B2559' }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        /* Desktop: lock CMS to the viewport so editor scroll does not move the preview iframe. */
        .cm-outer {
          width: 100%;
          max-width: 100%;
          display: flex;
          flex-direction: row;
          align-items: stretch;
          min-height: 100dvh;
        }
        @media (min-width: 901px) {
          .cm-outer {
            height: 100vh;
            height: 100dvh;
            max-height: 100vh;
            max-height: 100dvh;
            overflow: hidden;
          }
        }
        .desktop-sidebar { width: ${isExpanded ? '280px' : '110px'}; background: white; border-right: 1px solid #F1F1F1; display: flex; flex-direction: column; align-items: stretch; padding: 25px 0 0; z-index: 100; transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; position: fixed; top: 0; left: 0; height: 100vh; overflow: hidden; }
        .sidebar-logo-container { display: flex; justify-content: center; width: 100%; margin-bottom: 28px; align-self: center; }
        .sidebar-logo { width: ${isExpanded ? '120px' : '70px'}; transition: width 0.3s ease; }
        .sidebar-nav-scroll { flex: 1; min-height: 0; overflow-y: auto; width: 100%; display: flex; flex-direction: column; }
        .sidebar-nav-item { display: flex; align-items: center; width: 100%; padding: 0 ${isExpanded ? '28px' : '0'}; justify-content: ${isExpanded ? 'flex-start' : 'center'}; gap: 14px; margin-bottom: 6px; min-height: 48px; box-sizing: border-box; }
        .sidebar-label { display: ${isExpanded ? 'block' : 'none'}; font-weight: 600; font-size: 15px; color: #707EAE; line-height: 1.25; white-space: normal; max-width: 210px; }
        .sidebar-footer { flex-shrink: 0; width: 100%; padding: 16px 0 20px; margin-top: auto; border-top: 1px solid #f1f5f9; }
        .icon-box { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: #E9EDF7; color: #1B2559; }
        .icon-box.active { background: #F54E25; color: white; }
        .icon-box.inactive { background: transparent; color: #A3AED0; }
        .cm-main {
          flex: 1 1 0;
          min-width: 0;
          min-height: 0;
          height: 100%;
          max-height: 100%;
          overflow: hidden;
          margin-left: ${isExpanded ? '280px' : '110px'};
          transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          padding: 0;
          display: flex;
          flex-direction: column;
          background: #eef2f7;
        }
        .cm-topbar { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 10px 20px 12px; min-height: 56px; background: #fff; border-bottom: 1px solid #e2e8f0; z-index: 5; box-shadow: 0 1px 0 rgba(15, 23, 42, 0.04); }
        .cm-editor-shell { flex: 1 1 0; display: flex; min-height: 0; min-width: 0; overflow: hidden; }
        .cm-rail { width: 84px; flex-shrink: 0; background: #fff; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; align-items: center; padding: 14px 0; gap: 8px; z-index: 4; }
        .cm-rail-btn { width: 58px; height: 58px; border: none; border-radius: 14px; background: transparent; color: #64748b; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.15s, color 0.15s; }
        .cm-rail-btn:hover { background: #f1f5f9; color: #1B2559; }
        .cm-rail-btn--active { background: #e8edff; color: #1B2559; box-shadow: inset 0 0 0 1px #c7d2fe; }
        .cm-workspace { flex: 1; min-width: 0; min-height: 0; overflow: hidden; display: flex; flex-direction: row; align-items: stretch; padding: 0; }
        .cm-workspace--canvas-first { flex: 1; min-width: 0; min-height: 0; }
        .cm-workspace--custom-split { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
        .cm-props-drawer--start { border-left: none !important; border-right: 1px solid #e2e8f0; }
        .cm-preview-column { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; background: #e2e8f0; overflow: hidden; overscroll-behavior: contain; }
        .cm-preview-wrap { flex: 1; min-height: 0; display: flex; flex-direction: column; background: #fff; overflow: hidden; overscroll-behavior: contain; }
        .cm-drawer-toggle { flex-shrink: 0; width: 40px; align-self: stretch; border: none; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; background: #f1f5f9; color: #64748b; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.15s, color 0.15s; z-index: 6; }
        .cm-drawer-toggle:hover { background: #e2e8f0; color: #1B2559; }
        .cm-props-drawer { flex-shrink: 0; display: flex; flex-direction: column; min-height: 0; overflow: hidden; background: #f0f4f8; border-left: 1px solid #e2e8f0; width: min(400px, 36vw); transition: width 0.28s cubic-bezier(0.4, 0, 0.2, 1), border-width 0.2s; }
        .cm-props-drawer--collapsed { width: 0 !important; min-width: 0 !important; border-left: none; padding: 0; }
        .cm-props-scroll {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 12px 14px 20px;
          min-height: 0;
          overscroll-behavior: contain;
          overscroll-behavior-y: contain;
          -webkit-overflow-scrolling: touch;
        }
        .cm-drawer-head { margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; }
        .cm-drawer-select { width: 100%; margin-top: 8px; padding: 10px 12px; border-radius: 10px; border: 1px solid #E9EDF7; font-size: 13px; font-weight: 600; color: #1B2559; font-family: inherit; background: #fff; cursor: pointer; }
        .cm-preview-toolbar { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
        .cm-preview-frame { flex: 1; min-height: 0; position: relative; background: #e2e8f0; }
        .cm-preview-frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: none; display: block; }
        .cm-card { background: white; border: 1px solid #E9EDF7; border-radius: 14px; padding: 18px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06); }
        @media (max-width: 1100px) {
          .cm-props-drawer { width: min(360px, 42vw); }
        }
        @media (max-width: 900px) {
          .cm-rail { width: 64px; padding: 10px 0; }
          .cm-rail-btn { width: 50px; height: 50px; }
          .cm-workspace--canvas-first { flex-direction: column; }
          .cm-drawer-toggle { width: 100%; height: 40px; align-self: stretch; border-left: none; border-right: none; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; }
          .cm-preview-column { min-height: min(42vh, 560px); flex: 1 1 auto; }
          .cm-props-drawer { width: 100% !important; max-height: min(50vh, 520px); border-left: none; }
          .cm-props-drawer--collapsed { max-height: 0 !important; border: none; }
        }
        .cm-btn { border: none; border-radius: 10px; padding: 10px 16px; font-size: 13px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; font-family: inherit; }
        .cm-btn-primary { background: #F54E25; color: white; }
        .cm-btn-ghost { background: #E9EDF7; color: #1B2559; }
        @media (max-width: 900px) { .desktop-sidebar { display: none; } .cm-main { margin-left: 0; padding: 20px 16px; } }
        .cm-dnd-handle { -webkit-tap-highlight-color: transparent; }
        .cm-dnd-handle:focus-visible { outline: 2px solid #F54E25; outline-offset: 2px; }
      `}</style>

      <aside className="desktop-sidebar" onClick={() => setIsExpanded(!isExpanded)}>
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
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-recovery-roadmap'); }}>
            <div className="icon-box inactive"><HeartPulse size={22} /></div>
            <span className="sidebar-label">Recovery Roadmap</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => e.stopPropagation()}>
            <div className="icon-box active"><LayoutTemplate size={22} /></div>
            <span className="sidebar-label" style={{ color: '#F54E25' }}>Content management</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-appointments'); }}>
            <div className="icon-box inactive"><Calendar size={22} /></div>
            <span className="sidebar-label">Appointments</span>
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
            <LogOut size={22} color="#F54E25" style={{ marginLeft: isExpanded ? 0 : 10, flexShrink: 0 }} />
            <span className="sidebar-label" style={{ color: '#F54E25' }}>Logout</span>
          </div>
        </div>
      </aside>

      <main className="cm-main">
        <header className="cm-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', minWidth: 0 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#1B2559', lineHeight: 1.25 }}>Content management</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                CMS · Home page · Save syncs to Supabase and local storage
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                  marginTop: 8,
                }}
              >
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 700,
                    color: publicMaint ? '#b45309' : '#64748b',
                    userSelect: 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={publicMaint}
                    onChange={(e) => setPublicMaint(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: '#F54E25' }}
                  />
                  <Construction size={16} strokeWidth={2.25} aria-hidden />
                  Public site: maintenance screen
                </label>
                {maintSyncErr ? (
                  <span style={{ fontSize: 12, color: '#b91c1c', fontWeight: 600 }}>{maintSyncErr}</span>
                ) : null}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <button type="button" className="cm-btn cm-btn-primary" onClick={handleSave}>
              <Save size={16} /> Save
            </button>
            <button type="button" className="cm-btn cm-btn-ghost" onClick={handleReset}>
              <RotateCcw size={16} /> Reset
            </button>
            <button
              type="button"
              className="cm-btn cm-btn-ghost"
              onClick={() => window.open('/?cmsEdit=1', '_blank', 'noopener,noreferrer')}
              title="Opens the home page without the maintenance overlay"
            >
              <ExternalLink size={16} /> Preview site
            </button>
            <button
              type="button"
              className="cm-btn cm-btn-ghost"
              onClick={() => setPropsPanelOpen((o) => !o)}
              title={propsPanelOpen ? 'Hide editor panel' : 'Show editor panel'}
              aria-pressed={propsPanelOpen}
            >
              <PanelRight size={16} /> Panel
            </button>
          </div>
        </header>

        <div className="cm-editor-shell">
          <nav className="cm-rail" aria-label="Editor tools">
            {EDITOR_RAIL.map(({ id, label, title, Icon }) => (
              <button
                key={id}
                type="button"
                className={`cm-rail-btn${activeRailId === id ? ' cm-rail-btn--active' : ''}`}
                title={`${label} — ${title}`}
                aria-label={label}
                aria-current={activeRailId === id ? 'true' : undefined}
                onClick={() => selectRail(id)}
              >
                <Icon size={28} strokeWidth={activeRailId === id ? 2.25 : 2} />
              </button>
            ))}
          </nav>

          {tab === 'elements' ? (
          <div className="cm-workspace cm-workspace--custom-split">
            {(savedMsg || err) && (
              <div style={{ padding: '8px 16px', flexShrink: 0, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 13 }}>
                {savedMsg && <div style={{ color: '#166534', fontWeight: 600 }}>{savedMsg}</div>}
                {err && <div style={{ color: '#b91c1c', fontWeight: 600 }}>{err}</div>}
              </div>
            )}
            <CustomBlocksVisualEditor
              splitLayout
              livePreviewSlot={<LandingLivePreview content={content} onSectionSelect={handlePreviewSectionSelect} />}
              customSections={customSections}
              patchCustomBlock={patchCustomBlock}
              insertCustomBlockAt={insertCustomBlockAt}
              reorderCustomBlocks={reorderCustomBlocks}
              removeCustomBlock={removeCustomBlock}
            />
          </div>
          ) : (
          <div className="cm-workspace cm-workspace--canvas-first">
            <div
              className={'cm-props-drawer cm-props-drawer--start' + (!propsPanelOpen ? ' cm-props-drawer--collapsed' : '')}
            >
              <div className="cm-props-scroll">
              <div className="cm-drawer-head">
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em' }}>
                  {EDITOR_RAIL.find((r) => r.id === activeRailId)?.label ?? 'Editor'}
                </div>
                {activeRailId === 'sections' && (
                  <select
                    className="cm-drawer-select"
                    value={tab}
                    onChange={(e) => setTab(e.target.value)}
                    aria-label="Choose section to edit"
                  >
                    {SECTION_TABS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {drawerHint && (
                <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 14px', lineHeight: 1.5 }}>{drawerHint}</p>
              )}
              {savedMsg && <div style={{ color: '#166534', fontWeight: 600, marginBottom: 12 }}>{savedMsg}</div>}
              {err && <div style={{ color: '#b91c1c', fontWeight: 600, marginBottom: 12 }}>{err}</div>}

              <div className="cm-card" style={{ maxWidth: 920, margin: '0 auto' }}>
          {tab === 'order' && (
            <div>
              <SortableVerticalList
                items={normalizedSectionOrder}
                onReorder={(next) => {
                  setContent((prev) => {
                    const c = JSON.parse(JSON.stringify(prev));
                    c.sectionOrder = next;
                    return c;
                  });
                }}
                renderDragOverlay={(sectionId) => (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 18px',
                      minWidth: 240,
                      borderRadius: 12,
                      background: 'white',
                      border: '2px solid #F54E25',
                      boxShadow: '0 20px 50px rgba(27, 37, 89, 0.18)',
                      fontWeight: 700,
                      color: '#1B2559',
                    }}
                  >
                    <GripVertical size={18} color="#F54E25" aria-hidden />
                    {LANDING_SECTION_LABELS[sectionId] || sectionId}
                  </div>
                )}
              >
                {normalizedSectionOrder.map((sectionId) => (
                  <SortableRow key={sectionId} id={sectionId}>
                    {({ setHandleRef, handleListeners, handleAttributes }) => (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '12px 14px',
                          marginBottom: 8,
                          border: '1px solid #E9EDF7',
                          borderRadius: 12,
                          background: '#fafbff',
                        }}
                      >
                        <button
                          type="button"
                          className="cm-dnd-handle"
                          ref={setHandleRef}
                          {...handleListeners}
                          {...handleAttributes}
                          aria-label={`Drag to reorder ${LANDING_SECTION_LABELS[sectionId] || sectionId}`}
                          style={{
                            border: 'none',
                            background: '#E9EDF7',
                            padding: '8px 6px',
                            borderRadius: 8,
                            cursor: 'grab',
                            touchAction: 'none',
                            color: '#64748b',
                            flexShrink: 0,
                          }}
                        >
                          <GripVertical size={18} aria-hidden />
                        </button>
                        <span style={{ fontWeight: 700, flex: 1, color: '#1B2559' }}>
                          {LANDING_SECTION_LABELS[sectionId] || sectionId}
                        </span>
                        <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>#{sectionId}</span>
                      </div>
                    )}
                  </SortableRow>
                ))}
              </SortableVerticalList>
            </div>
          )}

          {tab === 'theme' && (
            <div>
              <h4 style={{ marginTop: 0, marginBottom: 10, color: '#1B2559' }}>Branding</h4>
              <CmsImageField
                label="Header logo"
                value={content.branding?.logoUrl ?? ''}
                onChange={(url) => set('branding.logoUrl', url)}
                hint="Shown in the top nav and mobile drawer. Clear to use the default bundled logo."
              />
              <CmsImageField
                label="Footer logo"
                value={content.branding?.footerLogoUrl ?? ''}
                onChange={(url) => set('branding.footerLogoUrl', url)}
                hint="Footer brand marks. Clear to use the default Hope Recovery asset."
              />
              <p style={{ fontSize: 12, fontWeight: 700, color: '#707EAE', margin: '14px 0 8px' }}>Logo size (optional)</p>
              <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 10px', lineHeight: 1.45 }}>
                Heights in pixels (width scales automatically). Type a number and press Tab or Enter — values apply when you leave the field. Leave empty for default sizes.
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: '0 12px',
                  marginBottom: 8,
                }}
              >
                <BrandingLogoPxInput
                  label="Header logo height (px)"
                  path="branding.headerLogoHeightPx"
                  valuePx={content.branding?.headerLogoHeightPx ?? 0}
                  maxPx={240}
                  placeholder="Default"
                  setField={set}
                />
                <BrandingLogoPxInput
                  label="Footer logo height (px)"
                  path="branding.footerLogoHeightPx"
                  valuePx={content.branding?.footerLogoHeightPx ?? 0}
                  maxPx={240}
                  placeholder="Default"
                  setField={set}
                />
                <BrandingLogoPxInput
                  label="Footer strip logo (px)"
                  path="branding.footerLogoStripHeightPx"
                  valuePx={content.branding?.footerLogoStripHeightPx ?? 0}
                  maxPx={120}
                  placeholder="20"
                  setField={set}
                />
              </div>
              <h4 style={{ marginTop: 18, marginBottom: 10, color: '#1B2559' }}>Colors &amp; type</h4>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '0 16px',
                  alignItems: 'start',
                }}
              >
              {[
                ['theme.accent', 'Accent', content.theme?.accent],
                ['theme.accentHover', 'Accent hover', content.theme?.accentHover],
                ['theme.accent2', 'Accent secondary', content.theme?.accent2],
                ['theme.cream', 'Page background', content.theme?.cream],
                ['theme.surface', 'Card surface', content.theme?.surface],
                ['theme.ink', 'Text color', content.theme?.ink],
                ['theme.radiusMd', 'Corner radius (e.g. 18px)', content.theme?.radiusMd],
                ['theme.fontStack', 'Font stack', content.theme?.fontStack],
              ].map(([path, lab, val]) => (
                <div key={path} style={{ ...FIELD, gridColumn: path === 'theme.fontStack' ? '1 / -1' : undefined }}>
                  <label style={LABEL}>{lab}</label>
                  <input style={INPUT} value={val ?? ''} onChange={(e) => set(path, e.target.value)} />
                </div>
              ))}
              </div>
            </div>
          )}

          {tab === 'nav' && (
            <div>
              {(content.navItems || []).map((item, i) => (
                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={LABEL}>Section ID</label>
                    <input
                      style={INPUT}
                      value={item.id}
                      onChange={(e) => {
                        const arr = [...content.navItems];
                        arr[i] = { ...arr[i], id: e.target.value.trim() };
                        set('navItems', arr);
                      }}
                    />
                  </div>
                  <div>
                    <label style={LABEL}>Label</label>
                    <input
                      style={INPUT}
                      value={item.label}
                      onChange={(e) => {
                        const arr = [...content.navItems];
                        arr[i] = { ...arr[i], label: e.target.value };
                        set('navItems', arr);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'hero' && (
            <div>
              <CmsImageField
                label="Hero background image"
                value={content.hero?.backgroundImageUrl ?? ''}
                onChange={(url) => set('hero.backgroundImageUrl', url)}
                hint="Replace, upload (Supabase Storage), or clear to use the default bundled image."
              />
              <p style={{ fontSize: 12, fontWeight: 700, color: '#707EAE', margin: '14px 0 8px' }}>Background image adjustment</p>
              <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 12px', lineHeight: 1.45 }}>
                How the photo is cropped and toned behind the headline. Preview updates after Save (or when the live page reloads from storage).
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '0 14px',
                  marginBottom: 12,
                }}
              >
                <div style={FIELD}>
                  <label style={LABEL}>Fit</label>
                  <select
                    style={INPUT}
                    value={content.hero?.backgroundObjectFit === 'contain' ? 'contain' : 'cover'}
                    onChange={(e) => set('hero.backgroundObjectFit', e.target.value)}
                  >
                    <option value="cover">Cover — fill area, crop edges</option>
                    <option value="contain">Contain — show full image, may letterbox</option>
                  </select>
                </div>
                <div style={FIELD}>
                  <label style={LABEL}>Focal point</label>
                  <select
                    style={INPUT}
                    value={content.hero?.backgroundObjectPosition || 'center'}
                    onChange={(e) => set('hero.backgroundObjectPosition', e.target.value)}
                  >
                    <option value="center">Center</option>
                    <option value="top">Top</option>
                    <option value="bottom">Bottom</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                    <option value="top left">Top left</option>
                    <option value="top right">Top right</option>
                    <option value="bottom left">Bottom left</option>
                    <option value="bottom right">Bottom right</option>
                    <option value="center top">Center top</option>
                    <option value="center bottom">Center bottom</option>
                  </select>
                </div>
              </div>
              <div style={FIELD}>
                <label style={LABEL}>Custom position (optional)</label>
                <input
                  style={INPUT}
                  placeholder="Overrides focal — e.g. 30% 60% or center 20%"
                  value={content.hero?.backgroundObjectPositionCustom ?? ''}
                  onChange={(e) => set('hero.backgroundObjectPositionCustom', e.target.value)}
                />
              </div>
              <div style={FIELD}>
                <label style={LABEL}>
                  Overlay strength — {content.hero?.backgroundOverlayOpacity ?? 100}%
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={content.hero?.backgroundOverlayOpacity ?? 100}
                  onChange={(e) => set('hero.backgroundOverlayOpacity', Number(e.target.value))}
                  style={{ width: '100%', maxWidth: 360, accentColor: '#F54E25' }}
                />
                <p style={{ fontSize: 11, color: '#94a3b8', margin: '6px 0 0' }}>Dark gradient over the photo for text contrast. 0% = no overlay.</p>
              </div>
              <div style={{ ...FIELD, marginBottom: 18 }}>
                <label style={LABEL}>
                  Brightness — {content.hero?.backgroundImageBrightness ?? 100}%
                </label>
                <input
                  type="range"
                  min={50}
                  max={150}
                  value={content.hero?.backgroundImageBrightness ?? 100}
                  onChange={(e) => set('hero.backgroundImageBrightness', Number(e.target.value))}
                  style={{ width: '100%', maxWidth: 360, accentColor: '#F54E25' }}
                />
                <p style={{ fontSize: 11, color: '#94a3b8', margin: '6px 0 0' }}>100% = unchanged. Lower darkens, higher brightens.</p>
              </div>
              {['hero.kicker', 'hero.line1', 'hero.line2', 'hero.suffix', 'hero.sub', 'hero.primaryCta', 'hero.secondaryCta'].map((path) => {
                const key = path.split('.')[1];
                const lab = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
                return (
                  <div key={path} style={FIELD}>
                    <label style={LABEL}>{lab}</label>
                    <textarea
                      style={{ ...INPUT, minHeight: path === 'hero.sub' ? 80 : 40 }}
                      value={content.hero?.[key] ?? ''}
                      onChange={(e) => set(path, e.target.value)}
                    />
                  </div>
                );
              })}
              <div style={FIELD}>
                <label style={LABEL}>Rotating words (one per line)</label>
                <textarea
                  style={{ ...INPUT, minHeight: 100 }}
                  value={(content.hero?.rotateWords || []).join('\n')}
                  onChange={(e) =>
                    set(
                      'hero.rotateWords',
                      e.target.value
                        .split('\n')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </div>
            </div>
          )}

          {tab === 'problem' && (
            <div>
              {['problem.eyebrow', 'problem.lead', 'problem.titleStart', 'problem.titleEmphasis', 'problem.titleMid', 'problem.titleEnd'].map((path) => {
                const key = path.split('.')[1];
                const lab = key;
                return (
                  <div key={path} style={FIELD}>
                    <label style={LABEL}>{lab}</label>
                    <textarea style={{ ...INPUT, minHeight: 48 }} value={content.problem?.[key] ?? ''} onChange={(e) => set(path, e.target.value)} />
                  </div>
                );
              })}
              <h4 style={{ marginTop: 20, marginBottom: 10 }}>Cards</h4>
              {(content.problem?.items || []).map((item, i) => (
                <div key={i} style={{ border: '1px solid #EEF2FF', borderRadius: 12, padding: 12, marginBottom: 10 }}>
                  <label style={LABEL}>Icon</label>
                  <select
                    style={{ ...INPUT, marginBottom: 8 }}
                    value={item.iconKey}
                    onChange={(e) => {
                      const arr = [...content.problem.items];
                      arr[i] = { ...arr[i], iconKey: e.target.value };
                      set('problem.items', arr);
                    }}
                  >
                    {PROBLEM_ICON_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                  <label style={LABEL}>Title</label>
                  <input
                    style={{ ...INPUT, marginBottom: 8 }}
                    value={item.title}
                    onChange={(e) => {
                      const arr = [...content.problem.items];
                      arr[i] = { ...arr[i], title: e.target.value };
                      set('problem.items', arr);
                    }}
                  />
                  <label style={LABEL}>Text</label>
                  <textarea
                    style={INPUT}
                    value={item.text}
                    onChange={(e) => {
                      const arr = [...content.problem.items];
                      arr[i] = { ...arr[i], text: e.target.value };
                      set('problem.items', arr);
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {tab === 'services' && (
            <div>
              {['services.eyebrow', 'services.lead', 'services.titleBefore', 'services.titleEm', 'services.titleAfter'].map((path) => {
                const key = path.split('.')[1];
                return (
                  <div key={path} style={FIELD}>
                    <label style={LABEL}>{key}</label>
                    <textarea style={INPUT} value={content.services?.[key] ?? ''} onChange={(e) => set(path, e.target.value)} />
                  </div>
                );
              })}
              <h4 style={{ marginTop: 16 }}>Program slides</h4>
              {(content.services?.slides || []).map((slide, i) => (
                <div key={slide.number} style={{ border: '1px solid #EEF2FF', borderRadius: 12, padding: 12, marginBottom: 10 }}>
                  <CmsImageField
                    label={`Slide ${slide.number} image`}
                    value={slide.imageUrl ?? ''}
                    onChange={(url) => {
                      const arr = [...content.services.slides];
                      arr[i] = { ...arr[i], imageUrl: url };
                      set('services.slides', arr);
                    }}
                    hint="Overrides the default program image for this slide. Clear to restore the built-in asset."
                  />
                  <label style={LABEL}>Title {slide.number}</label>
                  <input
                    style={{ ...INPUT, marginBottom: 8 }}
                    value={slide.title}
                    onChange={(e) => {
                      const arr = [...content.services.slides];
                      arr[i] = { ...arr[i], title: e.target.value };
                      set('services.slides', arr);
                    }}
                  />
                  <label style={LABEL}>Description</label>
                  <textarea
                    style={INPUT}
                    value={slide.text}
                    onChange={(e) => {
                      const arr = [...content.services.slides];
                      arr[i] = { ...arr[i], text: e.target.value };
                      set('services.slides', arr);
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {tab === 'proof' && (
            <div>
              {['proof.eyebrow', 'proof.lead', 'proof.titleBefore', 'proof.titleEm', 'proof.titleAfter', 'proof.partnersLabel'].map((path) => {
                const key = path.split('.')[1];
                return (
                  <div key={path} style={FIELD}>
                    <label style={LABEL}>{key}</label>
                    <textarea style={INPUT} value={content.proof?.[key] ?? ''} onChange={(e) => set(path, e.target.value)} />
                  </div>
                );
              })}
              {(content.proof?.stats || []).map((s, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={LABEL}>Stat {i + 1} headline</label>
                    <input
                      style={INPUT}
                      value={s.strong}
                      onChange={(e) => {
                        const arr = [...content.proof.stats];
                        arr[i] = { ...arr[i], strong: e.target.value };
                        set('proof.stats', arr);
                      }}
                    />
                  </div>
                  <div>
                    <label style={LABEL}>Description</label>
                    <input
                      style={INPUT}
                      value={s.text}
                      onChange={(e) => {
                        const arr = [...content.proof.stats];
                        arr[i] = { ...arr[i], text: e.target.value };
                        set('proof.stats', arr);
                      }}
                    />
                  </div>
                </div>
              ))}
              <CmsImageField
                label="DOH badge (second proof stat)"
                value={content.proof?.dohBadgeImageUrl ?? ''}
                onChange={(url) => set('proof.dohBadgeImageUrl', url)}
                hint="Replaces the seal next to the DOH stat. Clear to use the bundled image."
              />
              <h4 style={{ marginTop: 16, marginBottom: 8, color: '#1B2559' }}>Press logos</h4>
              <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12, lineHeight: 1.45 }}>
                Order matches the home page: GMA, TV5, WSJ, VICE, Rappler, Reaksyon. Clear a logo URL to use the default asset; clear article URL to use the built-in press link.
              </p>
              {PRESS_OUTLET_LABELS.map((pressLabel, i) => (
                <div
                  key={pressLabel}
                  style={{ border: '1px solid #EEF2FF', borderRadius: 12, padding: 12, marginBottom: 10 }}
                >
                  <div style={{ fontWeight: 700, color: '#1B2559', marginBottom: 8 }}>{pressLabel}</div>
                  <CmsImageField
                    label="Logo image"
                    value={content.proof?.pressOutlets?.[i]?.imageUrl ?? ''}
                    onChange={(url) => {
                      const arr = [...(content.proof?.pressOutlets || [])];
                      while (arr.length < PRESS_OUTLET_LABELS.length) arr.push({ imageUrl: '', articleUrl: '' });
                      arr[i] = { ...arr[i], imageUrl: url };
                      set('proof.pressOutlets', arr);
                    }}
                    hint="Optional override for this outlet’s mark."
                  />
                  <div style={FIELD}>
                    <label style={LABEL}>Article URL (optional)</label>
                    <input
                      style={INPUT}
                      placeholder="https://…"
                      value={content.proof?.pressOutlets?.[i]?.articleUrl ?? ''}
                      onChange={(e) => {
                        const arr = [...(content.proof?.pressOutlets || [])];
                        while (arr.length < PRESS_OUTLET_LABELS.length) arr.push({ imageUrl: '', articleUrl: '' });
                        arr[i] = { ...arr[i], articleUrl: e.target.value };
                        set('proof.pressOutlets', arr);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'testimonials' && (
            <div>
              {['testimonials.eyebrow', 'testimonials.lead', 'testimonials.titleBefore', 'testimonials.titleEm'].map((path) => {
                const key = path.split('.')[1];
                return (
                  <div key={path} style={FIELD}>
                    <label style={LABEL}>{key}</label>
                    <textarea style={INPUT} value={content.testimonials?.[key] ?? ''} onChange={(e) => set(path, e.target.value)} />
                  </div>
                );
              })}
              {(content.testimonials?.stories || []).map((story, i) => (
                <div key={story.id} style={{ border: '1px solid #EEF2FF', borderRadius: 12, padding: 12, marginBottom: 10 }}>
                  <label style={LABEL}>Name</label>
                  <input
                    style={{ ...INPUT, marginBottom: 8 }}
                    value={story.name}
                    onChange={(e) => {
                      const arr = [...content.testimonials.stories];
                      arr[i] = { ...arr[i], name: e.target.value };
                      set('testimonials.stories', arr);
                    }}
                  />
                  <label style={LABEL}>Role</label>
                  <input
                    style={{ ...INPUT, marginBottom: 8 }}
                    value={story.role}
                    onChange={(e) => {
                      const arr = [...content.testimonials.stories];
                      arr[i] = { ...arr[i], role: e.target.value };
                      set('testimonials.stories', arr);
                    }}
                  />
                  <label style={LABEL}>Quote</label>
                  <textarea
                    style={INPUT}
                    value={story.text}
                    onChange={(e) => {
                      const arr = [...content.testimonials.stories];
                      arr[i] = { ...arr[i], text: e.target.value };
                      set('testimonials.stories', arr);
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {tab === 'about' && (
            <div>
              <CmsImageField
                label="About section main image"
                value={content.about?.mainImageUrl ?? ''}
                onChange={(url) => set('about.mainImageUrl', url)}
                hint="Large image beside the About copy. Clear to use the default facility photo."
              />
              {['about.caption', 'about.eyebrow', 'about.body', 'about.titleBefore', 'about.titleEm1', 'about.titleBetween', 'about.titleEm2', 'about.titleAfter', 'about.valuesEyebrow', 'about.valuesHeadPrefix', 'about.valuesHeadGradient', 'about.valuesLead'].map((path) => {
                const key = path.split('.')[1];
                return (
                  <div key={path} style={FIELD}>
                    <label style={LABEL}>{key}</label>
                    <textarea style={INPUT} value={content.about?.[key] ?? ''} onChange={(e) => set(path, e.target.value)} />
                  </div>
                );
              })}
              <h4>Stats</h4>
              {(content.about?.stats || []).map((s, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginBottom: 10 }}>
                  <input
                    style={INPUT}
                    value={s.strong}
                    onChange={(e) => {
                      const arr = [...content.about.stats];
                      arr[i] = { ...arr[i], strong: e.target.value };
                      set('about.stats', arr);
                    }}
                  />
                  <input
                    style={INPUT}
                    value={s.label}
                    onChange={(e) => {
                      const arr = [...content.about.stats];
                      arr[i] = { ...arr[i], label: e.target.value };
                      set('about.stats', arr);
                    }}
                  />
                </div>
              ))}
              <h4>Values cards</h4>
              {(content.about?.values || []).map((v, i) => (
                <div key={i} style={{ border: '1px solid #EEF2FF', borderRadius: 12, padding: 12, marginBottom: 10 }}>
                  <CmsImageField
                    label={`Card ${i + 1} image`}
                    value={v.imageUrl ?? ''}
                    onChange={(url) => {
                      const arr = [...content.about.values];
                      arr[i] = { ...arr[i], imageUrl: url };
                      set('about.values', arr);
                    }}
                    hint="Clear to use the default photo for this value."
                  />
                  <div style={FIELD}>
                    <label style={LABEL}>Image alt text</label>
                    <input
                      style={INPUT}
                      value={v.alt ?? ''}
                      onChange={(e) => {
                        const arr = [...content.about.values];
                        arr[i] = { ...arr[i], alt: e.target.value };
                        set('about.values', arr);
                      }}
                    />
                  </div>
                  <input
                    style={{ ...INPUT, marginBottom: 6 }}
                    placeholder="Title"
                    value={v.title}
                    onChange={(e) => {
                      const arr = [...content.about.values];
                      arr[i] = { ...arr[i], title: e.target.value };
                      set('about.values', arr);
                    }}
                  />
                  <textarea
                    style={INPUT}
                    placeholder="Description"
                    value={v.desc}
                    onChange={(e) => {
                      const arr = [...content.about.values];
                      arr[i] = { ...arr[i], desc: e.target.value };
                      set('about.values', arr);
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {tab === 'faq' && (
            <div>
              {['faq.eyebrow', 'faq.lead', 'faq.titleBefore', 'faq.titleEm'].map((path) => {
                const key = path.split('.')[1];
                return (
                  <div key={path} style={FIELD}>
                    <label style={LABEL}>{key}</label>
                    <textarea style={INPUT} value={content.faq?.[key] ?? ''} onChange={(e) => set(path, e.target.value)} />
                  </div>
                );
              })}
              {(content.faq?.items || []).map((item, i) => (
                <div key={i} style={{ border: '1px solid #EEF2FF', borderRadius: 12, padding: 12, marginBottom: 10 }}>
                  <label style={LABEL}>Question</label>
                  <input
                    style={{ ...INPUT, marginBottom: 8 }}
                    value={item.q}
                    onChange={(e) => {
                      const arr = [...content.faq.items];
                      arr[i] = { ...arr[i], q: e.target.value };
                      set('faq.items', arr);
                    }}
                  />
                  <label style={LABEL}>Answer</label>
                  <textarea
                    style={INPUT}
                    value={item.a}
                    onChange={(e) => {
                      const arr = [...content.faq.items];
                      arr[i] = { ...arr[i], a: e.target.value };
                      set('faq.items', arr);
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {tab === 'footer' && (
            <div>
              <CmsImageField
                label="CTA phone mockup image"
                value={content.cta?.phoneMockupImageUrl ?? ''}
                onChange={(url) => set('cta.phoneMockupImageUrl', url)}
                hint="Image beside the final call-to-action. Clear to use the default phone mockup."
              />
              {['cta.eyebrow', 'cta.titleLine1', 'cta.titleLine2', 'cta.lead', 'cta.button'].map((path) => {
                const key = path.split('.')[1];
                return (
                  <div key={path} style={FIELD}>
                    <label style={LABEL}>{path}</label>
                    <textarea style={INPUT} value={content.cta?.[key] ?? ''} onChange={(e) => set(path, e.target.value)} />
                  </div>
                );
              })}
              <h4>Footer</h4>
              {['footer.brandTagline', 'footer.exploreTitle', 'footer.contactTitle', 'footer.legalTitle', 'footer.phone', 'footer.phoneTel', 'footer.email', 'footer.addressLine1', 'footer.addressLine2', 'footer.copyrightOrg', 'footer.brandSubtitle'].map((path) => {
                const key = path.split('.')[1];
                return (
                  <div key={path} style={FIELD}>
                    <label style={LABEL}>{key}</label>
                    <input style={INPUT} value={content.footer?.[key] ?? ''} onChange={(e) => set(path, e.target.value)} />
                  </div>
                );
              })}
            </div>
          )}

              </div>
            </div>
          </div>
            <button
              type="button"
              className="cm-drawer-toggle"
              onClick={() => setPropsPanelOpen((o) => !o)}
              title={propsPanelOpen ? 'Hide editor panel' : 'Show editor panel'}
              aria-expanded={propsPanelOpen}
            >
              {propsPanelOpen ? <ChevronRight size={22} strokeWidth={2} /> : <ChevronLeft size={22} strokeWidth={2} />}
            </button>
            <div className="cm-preview-column">
              <LandingLivePreview content={content} onSectionSelect={handlePreviewSectionSelect} />
            </div>
          </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default ContentManagement;
