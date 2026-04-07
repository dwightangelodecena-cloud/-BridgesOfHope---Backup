import React from 'react';

export const FAMILY_COLORS = {
  background: '#F6F4F1',
  surface: '#E4DED2',
  accent: '#F95C4B',
  text: '#000000',
};

const statusStyle = (tone) => {
  const map = {
    success: { bg: '#DFF7E9', color: '#0B6B34' },
    warning: { bg: '#FFEED7', color: '#8A4B00' },
    danger: { bg: '#FFE2DF', color: '#8E1C12' },
    neutral: { bg: FAMILY_COLORS.surface, color: FAMILY_COLORS.text },
  };
  return map[tone] || map.neutral;
};

export const StatusBadge = ({ label, tone = 'neutral' }) => {
  const toneStyle = statusStyle(tone);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        padding: '4px 10px',
        fontSize: 12,
        fontWeight: 700,
        background: toneStyle.bg,
        color: toneStyle.color,
      }}
    >
      {label}
    </span>
  );
};

export const Timeline = ({ items = [] }) => (
  <div style={{ display: 'grid', gap: 8 }}>
    {items.map((item, idx) => (
      <div key={`${item.label}-${idx}`} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div
          aria-hidden
          style={{
            width: 10,
            height: 10,
            marginTop: 5,
            borderRadius: '50%',
            background: item.active ? FAMILY_COLORS.accent : '#B0A99C',
            flexShrink: 0,
          }}
        />
        <div>
          <div style={{ color: FAMILY_COLORS.text, fontSize: 13, fontWeight: 700 }}>{item.label}</div>
          {item.meta ? <div style={{ color: '#4A443A', fontSize: 12 }}>{item.meta}</div> : null}
        </div>
      </div>
    ))}
  </div>
);

export const AuditLine = ({ text }) => (
  <div style={{ fontSize: 12, color: '#4A443A', marginTop: 6 }}>{text}</div>
);

export const EmptyState = ({ title, description }) => (
  <div
    role="status"
    style={{
      border: `1px dashed ${FAMILY_COLORS.accent}`,
      borderRadius: 14,
      background: FAMILY_COLORS.background,
      padding: 16,
    }}
  >
    <div style={{ color: FAMILY_COLORS.text, fontWeight: 800, marginBottom: 6 }}>{title}</div>
    <div style={{ color: '#4A443A', fontSize: 13 }}>{description}</div>
  </div>
);

export const LoadingState = ({ label = 'Loading...' }) => (
  <div style={{ fontSize: 13, color: '#4A443A', padding: '8px 0' }}>{label}</div>
);

export const ErrorState = ({ label = 'Something went wrong.', onRetry }) => (
  <div
    role="alert"
    style={{
      border: '1px solid #F7B7AF',
      borderRadius: 12,
      background: '#FFF0EE',
      padding: 12,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    }}
  >
    <span style={{ color: '#8E1C12', fontSize: 13, fontWeight: 700 }}>{label}</span>
    {onRetry ? (
      <button
        type="button"
        onClick={onRetry}
        style={{
          border: 'none',
          borderRadius: 10,
          background: FAMILY_COLORS.accent,
          color: '#fff',
          padding: '6px 10px',
          cursor: 'pointer',
          fontWeight: 700,
        }}
      >
        Retry
      </button>
    ) : null}
  </div>
);
