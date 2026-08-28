import React from 'react';

/**
 * Shared horizontal underline tab bar for admin "workspace" pages that combine several
 * previously-separate sidebar pages into one page with internal tabs (People, Communications,
 * Patient Care). Visual pattern lifted from ward-management.jsx's .wm-tabs (brand orange active
 * underline, navy active text, muted inactive text) — see admin-workspace-tabs.css.
 *
 * @param {{ id: string, label: string, badge?: number }[]} tabs
 * @param {string} activeTab
 * @param {(id: string) => void} onChange
 */
export function AdminWorkspaceTabs({ tabs, activeTab, onChange }) {
  return (
    <div className="aw-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`aw-tab${tab.id === activeTab ? ' aw-tab--active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.badge ? <span className="aw-tab-badge">{tab.badge > 99 ? '99+' : tab.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}
