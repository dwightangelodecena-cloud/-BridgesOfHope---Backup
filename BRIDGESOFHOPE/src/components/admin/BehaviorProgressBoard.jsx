import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const INTERVENTION_SUFFIX = ' — Intervention';

/** True when this tile is an intervention observation (no % weight toward the 100% total). */
export function isInterventionLabel(label) {
  return typeof label === 'string' && label.endsWith(INTERVENTION_SUFFIX);
}

/** Equal split of 100% across non-intervention squares only (basis points so totals stay exact). */
function buildPercentWeightByIndex(items) {
  /** @type {Record<number, number>} */
  const weights = {};
  const indices = [];
  items.forEach((label, i) => {
    if (!isInterventionLabel(label)) indices.push(i);
  });
  const n = indices.length;
  if (n === 0) return weights;
  const basisTotal = 10000;
  const base = Math.floor(basisTotal / n);
  let remainder = basisTotal - base * n;
  indices.forEach((idx) => {
    const bp = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    weights[idx] = bp / 100;
  });
  return weights;
}

/** Behavioral observations & interventions — order matches the physical board (1–50). */
export const BEHAVIOR_CHECKLIST_ITEMS = [
  'Obeys Basic Instruction',
  'Follows House Rules Daily Schedule',
  'Show Respect Toward Other',
  'Participates Without Resistance',
  'Takes Responsibility for Hygiene and Assigned Chores',
  'Respectful Relationships with Peers and Authority Figures',
  'Shows Signs of Emotional Regulation',
  'Consistently Performs Team Tasks',
  'Arrogant — Intervention',
  'Practices Discipline, Punctuality, and Follows Routines',
  'Disobedient — Intervention',
  'Displays Cooperation and Willingness',
  'Disrespectful — Intervention',
  'Starts Showing Initiative',
  'Dishonest — Intervention',
  'Applying Recovery Principle',
  'Irresponsible — Intervention',
  'Completes Personal and Group Tasks Without Reminders',
  'People Pleasing — Intervention',
  'Lazy — Intervention',
  'Shows Increasing Self-Awareness',
  'Non-Caring — Intervention',
  'Power Tripping — Intervention',
  'Demonstrates Thoughtful Decision-Making and Accountability',
  'Begins Applying Recovery Principles',
  'Leads Calmly and Responsibly',
  'Coaches and Corrects Peers Respectfully and Firmly',
  'Sneaky — Intervention',
  'Lazy — Intervention',
  'Maintains High Standards of Behavior and Consistency',
  'Power Tripping — Intervention',
  'Shows Self-Discipline and Emotional Maturity',
  'Irresponsible — Intervention',
  'Trusted with Small Leadership Roles',
  'Opens Up Vulnerably in Group and Written Reflections',
  'Handles Confrontation with Humility',
  'Owns Up to Past Behaviors Without Blaming Others',
  'Lazy — Intervention',
  'Neglectful — Intervention',
  'Maintains a Consistent and Respectful Presence',
  'Arrogant — Intervention',
  'Practices Daily Accountability and Internal Motivation',
  'People Pleasing — Intervention',
  'Demonstrates Integrity, Responsibility, and Compassion',
  'Sneaky — Intervention',
  'Actively Mentors Others and Models Recovery Behavior',
  'Power Tripping — Intervention',
  'Maintains Balance Under Pressure and in Conflict',
  'Neglectful — Intervention',
  'Upholds Program Structure and Values Consistently',
];

const PERCENT_WEIGHT_BY_INDEX = buildPercentWeightByIndex(BEHAVIOR_CHECKLIST_ITEMS);

/**
 * @param {Record<number|string, boolean> | null | undefined} checked
 * @returns {number} 0–100; only non-intervention (weighted) tiles count.
 */
export function computeBehaviorBoardProgressPercent(checked) {
  if (!checked || typeof checked !== 'object') return 0;
  let sum = 0;
  for (let i = 0; i < BEHAVIOR_CHECKLIST_ITEMS.length; i++) {
    const w = PERCENT_WEIGHT_BY_INDEX[i];
    if (w != null && checked[i]) sum += w;
  }
  return Math.min(100, Math.round(sum * 100) / 100);
}

const LADDERS = [
  { from: 8, to: 26 },
  { from: 16, to: 18 },
  { from: 34, to: 35 },
];

const SNAKES = [
  { from: 49, to: 39 },
  { from: 47, to: 31 },
  { from: 45, to: 28 },
  { from: 43, to: 19 },
  { from: 41, to: 9 },
  { from: 38, to: 20 },
  { from: 15, to: 14 },
];

/** Top → bottom display rows; path starts at 1 (bottom-left area) and ends at Completion. */
const BOARD_ROWS = [
  [
    { kind: 'completion' },
    { kind: 'reintegration' },
    ...[50, 49, 48, 47, 46, 45, 44].map((n) => ({ kind: 'square', n })),
  ],
  [35, 36, 37, 38, 39, 40, 41, 42, 43].map((n) => ({ kind: 'square', n })),
  [34, 33, 32, 31, 30, 29, 28, 27, 26].map((n) => ({ kind: 'square', n })),
  [17, 18, 19, 20, 21, 22, 23, 24, 25].map((n) => ({ kind: 'square', n })),
  [16, 15, 14, 13, 12, 11, 10, 9, 8].map((n) => ({ kind: 'square', n })),
  [null, 1, 2, 3, 4, 5, 6, 7, null].map((x) =>
    x == null ? { kind: 'empty' } : { kind: 'square', n: x }
  ),
];

/** Path reads top → bottom: square 1 at top, Completion / Reintegration at bottom. */
const DISPLAY_ROWS = [...BOARD_ROWS].reverse();

const TILE_FILL = '#FFFFFF';
const TILE_FILL_ALT = '#FAFBFC';

/** Tier styling: color on borders only. Intervention tiles use a separate neutral slate (not program tier). */
const TIERS = {
  prospect: { label: 'Prospect', border: '#F97316' },
  younger: { label: 'Younger', border: '#059669' },
  crew: { label: 'Crew', border: '#7C3AED' },
  assistant: { label: 'Assistant', border: '#F59E0B' },
  head: { label: 'Head', border: '#C026D3' },
  senior: { label: 'Senior', border: '#2563EB' },
  intervention: { label: 'Intervention', border: '#0E7490' },
  reintegration: { label: 'Reintegration', border: '#991B1B' },
  completion: { label: 'Completion', border: '#4F46E5' },
  empty: { label: '', border: '#94A3B8' },
};

const LEGEND_KEYS = [
  'prospect',
  'younger',
  'crew',
  'assistant',
  'head',
  'senior',
  'intervention',
  'reintegration',
  'completion',
];

function tierForSquare(n) {
  const orange = new Set([1, 2, 3, 14, 15, 17, 44, 46, 48, 50]);
  if (orange.has(n)) return 'prospect';
  if (n >= 4 && n <= 7) return 'younger';
  if ((n >= 8 && n <= 13) || n === 16) return 'crew';
  if ([18, 19, 21, 24, 25].includes(n)) return 'assistant';
  const head = new Set([
    20, 22, 23, 26, 27, 28, 29, 30, 31, 32, 33, 34, 38, 39, 41, 43, 45, 47, 49,
  ]);
  if (head.has(n)) return 'head';
  if ([35, 36, 37, 40, 42].includes(n)) return 'senior';
  return 'head';
}

export const renderBehaviorChecklistLabel = (text) => {
  const isIntervention = text.endsWith(INTERVENTION_SUFFIX);
  const display = isIntervention ? text.slice(0, -INTERVENTION_SUFFIX.length) : text;

  if (!isIntervention) {
    return <span style={{ fontWeight: 600, fontSize: '0.8em', color: '#1E293B' }}>{display}</span>;
  }

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
          color: '#475569',
          background: '#F1F5F9',
          border: '1px solid #CBD5E1',
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

/**
 * @param {Object} props
 * @param {Record<number|string, boolean>} props.checked
 * @param {(updater: (prev: Record<number|string, boolean>) => Record<number|string, boolean>) => void} props.setChecked
 * @param {string} props.patientName
 * @param {boolean} [props.embedded] — hide header/name when nested in clinical layout
 */
const COMPLETION_MODAL_BODY =
  'All checkable milestones will be checked except Reintegration. Intervention tiles have no checkbox. Recovery progress will show 100%.';

const UNCHECK_COMPLETION_MODAL_BODY =
  'This will remove completion and uncheck every milestone on the board (including Reintegration). Recovery progress will return to 0%.';

export default function BehaviorProgressBoard({ checked, setChecked, patientName, embedded = false }) {
  /** null | 'complete' — mark all | 'clear' — uncheck all */
  const [completionModalMode, setCompletionModalMode] = useState(null);

  const toggle = (key) => {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const applyCompletionConfirmed = () => {
    setChecked((prev) => {
      const next = { ...prev };
      for (let i = 0; i < BEHAVIOR_CHECKLIST_ITEMS.length; i++) {
        if (!isInterventionLabel(BEHAVIOR_CHECKLIST_ITEMS[i])) {
          next[i] = true;
        }
      }
      next.completion = true;
      next.reintegration = false;
      return next;
    });
  };

  const clearAllMilestoneChecks = () => {
    setChecked((prev) => {
      const next = { ...prev };
      for (let i = 0; i < BEHAVIOR_CHECKLIST_ITEMS.length; i++) {
        next[i] = false;
      }
      next.completion = false;
      next.reintegration = false;
      return next;
    });
  };

  const closeCompletionModal = () => setCompletionModalMode(null);

  const confirmCompletionModal = () => {
    if (completionModalMode === 'complete') {
      applyCompletionConfirmed();
    } else if (completionModalMode === 'clear') {
      clearAllMilestoneChecks();
    }
    setCompletionModalMode(null);
  };

  useEffect(() => {
    if (!completionModalMode) return;
    const onKey = (ev) => {
      if (ev.key === 'Escape') setCompletionModalMode(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [completionModalMode]);

  const handleCompletionChange = (e) => {
    const wantChecked = e.target.checked;
    if (wantChecked) {
      setCompletionModalMode('complete');
      return;
    }
    if (checked.completion) {
      setCompletionModalMode('clear');
      return;
    }
    setChecked((prev) => ({ ...prev, completion: false }));
  };

  return (
    <div>
      {!embedded ? (
        <div
          style={{
            textAlign: 'center',
            marginBottom: 10,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.2em',
            color: '#475569',
          }}
        >
          CAVITE
        </div>
      ) : null}

      <div
        className="behavior-progress-board"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(9, minmax(0, 1fr))',
          gridAutoRows: 'minmax(100px, auto)',
          gap: 4,
          width: '100%',
          maxWidth: '100%',
          margin: '0 auto',
          padding: 12,
          borderRadius: 12,
          background: TILE_FILL_ALT,
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
        }}
      >
        {DISPLAY_ROWS.map((row, ri) => {
          return (
            <React.Fragment key={ri}>
              {row.map((cell, ci) => {
                if (cell.kind === 'empty') {
                  return (
                    <div
                      key={`e-${ri}-${ci}`}
                      style={{
                        minHeight: 96,
                        height: '100%',
                        borderRadius: 8,
                        background: TILE_FILL_ALT,
                        border: `1px dashed ${TIERS.empty.border}`,
                      }}
                    />
                  );
                }

                if (cell.kind === 'completion') {
                  const t = TIERS.completion;
                  return (
                    <div
                      key={`completion-${ri}`}
                      style={{
                        minHeight: 96,
                        height: '100%',
                        borderRadius: 8,
                        background: TILE_FILL,
                        border: `2px solid ${t.border}`,
                        padding: 8,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
                      }}
                    >
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Completion
                      </span>
                      <input
                        type="checkbox"
                        checked={!!checked.completion}
                        onChange={handleCompletionChange}
                        aria-label="Completion milestone"
                        style={{ width: 15, height: 15, accentColor: t.border, cursor: 'pointer' }}
                      />
                    </div>
                  );
                }

                if (cell.kind === 'reintegration') {
                  const t = TIERS.reintegration;
                  return (
                    <div
                      key={`reintegration-${ri}`}
                      style={{
                        minHeight: 96,
                        height: '100%',
                        borderRadius: 8,
                        background: TILE_FILL,
                        border: `2px solid ${t.border}`,
                        padding: 8,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: '#334155',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          textAlign: 'center',
                          lineHeight: 1.2,
                        }}
                      >
                        Reintegration
                      </span>
                      <input
                        type="checkbox"
                        checked={!!checked.reintegration}
                        onChange={() => toggle('reintegration')}
                        aria-label="Reintegration milestone"
                        style={{ width: 15, height: 15, accentColor: t.border, cursor: 'pointer' }}
                      />
                    </div>
                  );
                }

                const n = cell.n;
                const label = BEHAVIOR_CHECKLIST_ITEMS[n - 1];
                const isInterventionTile = isInterventionLabel(label);
                const tierKey = isInterventionTile ? 'intervention' : tierForSquare(n);
                const t = TIERS[tierKey];
                const ladder = LADDERS.find((l) => l.from === n);
                const snake = SNAKES.find((s) => s.from === n);
                const idx = n - 1;
                const tileWeightPct = PERCENT_WEIGHT_BY_INDEX[idx];

                return (
                  <div
                    key={`${ri}-${ci}-${n}`}
                    style={{
                      position: 'relative',
                      minHeight: 96,
                      height: '100%',
                      borderRadius: 8,
                      background: TILE_FILL,
                      border: `2px solid ${t.border}`,
                      padding: '8px 8px 26px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
                      {isInterventionTile ? (
                        <span
                          style={{ width: 14, height: 14, flexShrink: 0 }}
                          aria-hidden
                          title="Observation only — no checklist"
                        />
                      ) : (
                        <input
                          type="checkbox"
                          checked={!!checked[idx]}
                          onChange={() => toggle(idx)}
                          aria-label={`Square ${n}`}
                          style={{ width: 14, height: 14, accentColor: t.border, cursor: 'pointer', flexShrink: 0 }}
                        />
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                        {ladder ? (
                          <span
                            title={`Ladder to square ${ladder.to}`}
                            style={{
                              fontSize: 8,
                              fontWeight: 700,
                              color: '#475569',
                              background: TILE_FILL,
                              padding: '2px 5px',
                              borderRadius: 4,
                              border: `1px solid ${t.border}`,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            L {ladder.to}
                          </span>
                        ) : null}
                        {snake ? (
                          <span
                            title={`Snake to square ${snake.to}`}
                            style={{
                              fontSize: 8,
                              fontWeight: 700,
                              color: '#475569',
                              background: TILE_FILL,
                              padding: '2px 5px',
                              borderRadius: 4,
                              border: `1px solid ${TIERS.empty.border}`,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            S {snake.to}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div style={{ flex: 1, minHeight: 0, lineHeight: 1.3, overflow: 'hidden' }}>{renderBehaviorChecklistLabel(label)}</div>
                    <div
                      style={{
                        position: 'absolute',
                        right: 6,
                        bottom: 4,
                        textAlign: 'right',
                        lineHeight: 1.1,
                      }}
                    >
                      {tileWeightPct != null ? (
                        <div style={{ fontSize: 8, fontWeight: 600, color: '#64748B', marginBottom: 2 }}>
                          {`${tileWeightPct.toFixed(2)}%`}
                        </div>
                      ) : null}
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#0F172A',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {n}
                      </span>
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 12,
          marginTop: 16,
          padding: '12px 16px',
          background: TILE_FILL,
          borderRadius: 10,
          border: '1px solid #E2E8F0',
          fontSize: 10,
          justifyContent: 'center',
        }}
      >
        {LEGEND_KEYS.map((key) => {
          const v = TIERS[key];
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: 2,
                  background: TILE_FILL,
                  border: `2px solid ${v.border}`,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontWeight: 600, color: '#475569' }}>{v.label}</span>
            </div>
          );
        })}
        <span style={{ color: '#94A3B8', fontWeight: 500 }}>· L / S tags show ladder and snake targets</span>
      </div>

      {!embedded ? (
        <div
          style={{
            marginTop: 14,
            padding: '12px 16px',
            borderRadius: 10,
            border: '1px solid #E2E8F0',
            background: TILE_FILL,
            maxWidth: 420,
          }}
        >
          <p style={{ fontSize: 9, fontWeight: 600, color: '#94A3B8', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Name
          </p>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', margin: 0 }}>{patientName || '—'}</p>
        </div>
      ) : null}

      {completionModalMode
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="completion-modal-title"
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10050,
                background: 'rgba(15, 23, 42, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 20,
              }}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) closeCompletionModal();
              }}
            >
              <div
                style={{
                  background: TILE_FILL,
                  borderRadius: 14,
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
                  maxWidth: 420,
                  width: '100%',
                  padding: '24px 24px 20px',
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <h2
                  id="completion-modal-title"
                  style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 800, color: '#1B2559' }}
                >
                  {completionModalMode === 'complete' ? 'Mark completion?' : 'Remove completion?'}
                </h2>
                <p style={{ margin: '0 0 22px', fontSize: 13, color: '#64748B', lineHeight: 1.55 }}>
                  {completionModalMode === 'complete' ? COMPLETION_MODAL_BODY : UNCHECK_COMPLETION_MODAL_BODY}
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={closeCompletionModal}
                    style={{
                      padding: '10px 18px',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#475569',
                      background: '#F1F5F9',
                      border: '1px solid #E2E8F0',
                      borderRadius: 10,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmCompletionModal}
                    style={{
                      padding: '10px 18px',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#fff',
                      background:
                        completionModalMode === 'complete' ? TIERS.completion.border : TIERS.reintegration.border,
                      border: 'none',
                      borderRadius: 10,
                      cursor: 'pointer',
                    }}
                  >
                    {completionModalMode === 'complete' ? 'Confirm' : 'Remove all'}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
