import { INTERVENTION_SUFFIX } from '@/lib/behaviorChecklist';

export const renderBehaviorChecklistLabel = (text, interventionStatus = 'pending') => {
  const isIntervention = text.endsWith(INTERVENTION_SUFFIX);
  const display = isIntervention ? text.slice(0, -INTERVENTION_SUFFIX.length) : text;

  if (!isIntervention) {
    return <span style={{ fontWeight: 600, fontSize: '0.8em', color: '#1E293B' }}>{display}</span>;
  }

  const palette =
    interventionStatus === 'current'
      ? { fg: '#854D0E', bg: '#FEF9C3', border: '#EAB308' }
      : interventionStatus === 'passed'
        ? { fg: '#166534', bg: '#ECFDF3', border: '#22C55E' }
        : interventionStatus === 'failed'
          ? { fg: '#991B1B', bg: '#FEE2E2', border: '#EF4444' }
          : { fg: '#991B1B', bg: '#FEF2F2', border: '#DC2626' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontWeight: 600, fontSize: '0.8em', color: '#1E293B' }}>{display}</span>
      <span
        style={{
          alignSelf: 'flex-start',
          fontSize: '0.65em',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: palette.fg,
          background: palette.bg,
          border: `1px solid ${palette.border}`,
          padding: '3px 7px',
          borderRadius: 4,
          lineHeight: 1.2,
        }}
      >
        Intervention
      </span>
    </div>
  );
};
