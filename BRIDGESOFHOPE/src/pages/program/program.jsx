import React from 'react';

export default function ProgramPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F8F9FD',
        fontFamily: 'Inter, sans-serif',
        color: '#1B2559',
        padding: 24,
      }}
    >
      <div
        style={{
          width: 'min(100%, 780px)',
          background: '#fff',
          border: '1px solid #E9EDF7',
          borderRadius: 20,
          padding: '28px 24px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>Program Page</h1>
        <p style={{ margin: '10px 0 0', fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>
          Program workspace placeholder. Your teammate can implement the full Program features here.
        </p>
      </div>
    </div>
  );
}
