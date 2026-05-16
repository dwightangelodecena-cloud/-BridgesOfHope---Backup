/** Shared light-theme form + modal button styles (avoids Vite dark defaults / OS color-scheme). */

export const appFieldBase = {
  boxSizing: 'border-box',
  width: '100%',
  background: '#ffffff',
  color: '#0f172a',
  border: '1px solid #cbd5e1',
  borderRadius: 12,
  padding: '12px 14px',
  fontSize: 14,
  lineHeight: 1.5,
  fontFamily: 'inherit',
  colorScheme: 'light',
  WebkitTextFillColor: '#0f172a',
};

export const appTextareaStyle = {
  ...appFieldBase,
  resize: 'vertical',
  minHeight: 100,
};

export const appInputStyle = {
  ...appFieldBase,
};

export const appModalPanelStyle = {
  background: '#ffffff',
  borderRadius: 18,
  padding: '24px 28px',
  maxWidth: 480,
  width: '100%',
  boxShadow: '0 20px 60px rgba(15, 23, 42, 0.2)',
  color: '#1b2559',
  colorScheme: 'light',
};

export const appBtnSecondary = {
  padding: '11px 16px',
  borderRadius: 10,
  border: '1px solid #e2e8f0',
  background: '#ffffff',
  color: '#475569',
  fontWeight: 700,
  fontSize: 13,
  lineHeight: 1.35,
  fontFamily: 'inherit',
  cursor: 'pointer',
  WebkitTextFillColor: '#475569',
  minHeight: 42,
  boxSizing: 'border-box',
};

export const appBtnSecondaryDisabled = {
  ...appBtnSecondary,
  cursor: 'not-allowed',
  opacity: 0.65,
};

export const appBtnPrimaryGreen = {
  padding: '11px 18px',
  borderRadius: 10,
  border: 'none',
  background: '#10b981',
  color: '#ffffff',
  fontWeight: 800,
  fontSize: 13,
  lineHeight: 1.35,
  fontFamily: 'inherit',
  cursor: 'pointer',
  WebkitTextFillColor: '#ffffff',
  minHeight: 42,
  boxSizing: 'border-box',
  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
};

export const appBtnPrimaryRed = {
  ...appBtnPrimaryGreen,
  background: '#be123c',
  boxShadow: '0 4px 14px rgba(190, 18, 60, 0.25)',
};

/** @deprecated Prefer className `app-leave-option` + `app-leave-option--selected` */
export function appLeaveOptionStyle(selected) {
  return {
    textAlign: 'left',
    padding: '14px 16px',
    borderRadius: 12,
    border: selected ? '2px solid #4338ca' : '1px solid #e2e8f0',
    background: selected ? '#eef2ff' : '#ffffff',
    color: '#1b2559',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 14,
    lineHeight: 1.4,
    fontFamily: 'inherit',
    WebkitTextFillColor: '#1b2559',
    minHeight: 48,
    boxSizing: 'border-box',
    width: '100%',
  };
}
