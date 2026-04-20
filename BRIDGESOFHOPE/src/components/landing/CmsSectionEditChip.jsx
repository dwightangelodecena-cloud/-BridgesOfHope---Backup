import React from 'react';

const CHIP_STYLE = {
  position: 'absolute',
  top: 12,
  right: 12,
  zIndex: 50,
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 700,
  borderRadius: 8,
  border: '1px solid #7c3aed',
  background: 'rgba(255,255,255,0.96)',
  color: '#5b21b6',
  cursor: 'pointer',
  boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
  fontFamily: 'inherit',
};

/**
 * Shown only inside the CMS live preview iframe (?cmsEdit=1). Click posts to parent
 * to open the matching section in the site editor.
 */
export default function CmsSectionEditChip({ sectionId, label }) {
  if (typeof window === 'undefined') return null;
  if (window.parent === window) return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get('cmsEdit') !== '1') return null;

  return (
    <button
      type="button"
      className="cms-section-edit-chip"
      style={CHIP_STYLE}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        window.parent.postMessage({ type: 'cms-select-section', sectionId }, window.location.origin);
      }}
    >
      Edit {label}
    </button>
  );
}
