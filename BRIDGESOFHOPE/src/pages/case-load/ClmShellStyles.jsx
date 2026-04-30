import React from 'react';

/** Shared CSS for all CLM shell routes (sidebar, cards, charts, mobile nav). */
export default function ClmShellStyles() {
  return (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        /* --cl-sidebar-w must live on .cl-outer so .cl-main (sibling) inherits it; defining it only on .desktop-sidebar left main margin at 0 */
        .cl-outer { --cl-sidebar-w: 280px; width: 100%; max-width: 100%; overflow-x: hidden; }
        .cl-outer.sidebar-collapsed { --cl-sidebar-w: 110px; }
        .desktop-sidebar { --cl-logo-w: 120px; --cl-nav-pad: 28px; width: var(--cl-sidebar-w); background: white; border-right: 1px solid #F1F1F1; display: flex; flex-direction: column; align-items: stretch; padding: 25px 0 0; z-index: 100; transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; position: fixed; top: 0; left: 0; height: 100vh; overflow: hidden; flex-shrink: 0; box-shadow: 4px 0 24px rgba(27, 37, 89, 0.06); }
        .desktop-sidebar.sidebar-collapsed { --cl-logo-w: 70px; --cl-nav-pad: 0; }
        .desktop-sidebar.sidebar-collapsed .sidebar-label { display: none; }
        .desktop-sidebar.sidebar-collapsed .sidebar-nav-item { justify-content: center; }
        .sidebar-logo-container { display: flex; justify-content: center; width: 100%; margin-bottom: 28px; align-self: center; }
        .sidebar-logo { width: var(--cl-logo-w); transition: width 0.3s ease; }
        .sidebar-nav-scroll { flex: 1; min-height: 0; overflow-y: auto; width: 100%; display: flex; flex-direction: column; }
        .sidebar-nav-item { display: flex; align-items: center; width: 100%; padding: 0 var(--cl-nav-pad); justify-content: flex-start; gap: 14px; margin-bottom: 6px; min-height: 48px; box-sizing: border-box; text-decoration: none; color: inherit; border: none; background: transparent; cursor: pointer; font-family: inherit; }
        .sidebar-nav-item.cl-nav-active .sidebar-label { color: #F54E25 !important; }
        .sidebar-label { display: block; font-weight: 600; font-size: 15px; color: #707EAE; line-height: 1.25; white-space: normal; max-width: 210px; }
        .sidebar-footer { flex-shrink: 0; width: 100%; padding: 16px 0 20px; margin-top: auto; border-top: 1px solid #f1f5f9; }
        .sidebar-footer .sidebar-nav-item + .sidebar-nav-item { margin-top: 6px; }
        .icon-box { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: #E9EDF7; color: #1B2559; flex-shrink: 0; transition: all 0.2s; }
        .icon-box.active { background: #F54E25; color: white; }
        .icon-box.inactive { background: transparent; color: #A3AED0; }
        .cl-main { flex: 1 1 0; min-width: 0; min-height: 100vh; margin-left: var(--cl-sidebar-w, 280px); transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1); padding: 32px 28px 48px; width: 100%; max-width: 100%; box-sizing: border-box; overflow-x: hidden; position: relative; z-index: 1; }
        .cl-page { max-width: 1100px; width: 100%; }
        .cl-page--narrow { max-width: 560px; }
        .cl-page-head { font-size: 28px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; margin: 0 0 8px; line-height: 1.2; }
        .cl-page-lede { font-size: 13px; color: #707EAE; margin: 0 0 22px; font-weight: 500; line-height: 1.5; max-width: 52rem; }
        .cl-page-body { display: flex; flex-direction: column; gap: 14px; }
        .cl-card { background: white; border: 1px solid #E9EDF7; border-radius: 20px; padding: 20px; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04); }
        .cl-card-title { font-size: 16px; font-weight: 800; color: #1B2559; margin: 0 0 10px; }
        .cl-section-label { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px; }
        .cl-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
        .cl-two-col { grid-template-columns: 1.2fr 1fr; }
        .cl-incidents-grid { grid-template-columns: 1fr 1fr; }
        .cl-qa-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .cl-qa-h2 { font-size: 15px; font-weight: 800; color: #1B2559; margin: 0 0 8px; }
        .cl-qa-p { font-size: 13px; color: #475569; line-height: 1.55; margin: 0 0 8px; }
        .cl-qa-k { display: block; font-size: 12px; font-weight: 700; color: #0F766E; margin-top: 8px; }
        .cl-chart-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .cl-chart-card { background: #fff; border: 1px solid #E9EDF7; border-radius: 20px; padding: 16px 16px 8px; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04); min-height: 320px; display: flex; flex-direction: column; }
        .cl-chart-title { font-size: 14px; font-weight: 800; color: #1B2559; margin: 0 0 4px; }
        .cl-chart-sub { font-size: 11px; color: #94A3B8; margin: 0 0 10px; font-weight: 500; }
        .cl-chart-wrap { flex: 1; min-height: 240px; width: 100%; }
        .cl-chart-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: #94A3B8; font-size: 13px; font-weight: 600; min-height: 220px; }
        .cl-chart-split { display: grid; grid-template-columns: 1fr 1.2fr; gap: 8; flex: 1; min-height: 240px; align-items: stretch; }
        .cl-metric { background: #fff; border: 1px solid #E9EDF7; border-radius: 14px; padding: 14px; }
        .cl-input, .cl-textarea, .cl-select {
          width: 100%;
          border: 1px solid #dbe5f3;
          border-radius: 10px;
          padding: 9px 10px;
          font-size: 13px;
          font-family: 'Inter', sans-serif;
          background: #fff;
          color: #1B2559;
        }
        .cl-textarea { min-height: 78px; resize: vertical; }
        .cl-label { display: block; font-size: 12px; font-weight: 700; color: #64748b; margin-bottom: 6px; }
        .cl-save-btn {
          border: none;
          background: #0F766E;
          color: #fff;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
        }
        .db-mobile-only { display: none; }
        @media (max-width: 900px) {
          .cl-grid { grid-template-columns: 1fr; }
          .cl-two-col { grid-template-columns: 1fr !important; }
          .cl-incidents-grid { grid-template-columns: 1fr !important; }
          .cl-qa-grid { grid-template-columns: 1fr; }
          .cl-chart-grid { grid-template-columns: 1fr; }
          .cl-chart-split { grid-template-columns: 1fr; }
        }
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .db-mobile-only { display: flex !important; }
          .cl-main { margin-left: 0 !important; width: 100vw !important; padding: 20px 12px 100px 12px !important; }
          .db-mobile-top-bar { display: flex !important; width: 100vw; background: white; z-index: 1001; position: sticky; top: 0; padding: 0 20px; height: 64px; align-items: center; justify-content: space-between; border-bottom: 1px solid #F1F1F1; }
          .db-mobile-bottom-nav { position: fixed; bottom: 0; left: 0; width: 100vw; height: 72px; background: white; border-top: 1px solid #F1F1F1; display: flex; justify-content: space-around; align-items: center; z-index: 1000; box-shadow: 0 -4px 20px rgba(0,0,0,0.06); flex-wrap: nowrap; overflow-x: auto; }
          .mob-nav-item { display: flex; flex-direction: column; align-items: center; font-size: 8px; color: #A3AED0; cursor: pointer; max-width: 14%; text-align: center; flex-shrink: 0; }
          .mob-nav-item.active { color: #F54E25; }
        }
      `}</style>
  );
}
