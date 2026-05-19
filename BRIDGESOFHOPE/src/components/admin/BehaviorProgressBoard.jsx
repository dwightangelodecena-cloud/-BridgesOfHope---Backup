import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { loadLadderProfiles, saveLadderProfiles } from '@/lib/recoveryLadderStorage';

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

/** Unchecked ladder — used until program/nurse explicitly saves checks in the database. */
export function emptyBehaviorChecks() {
  /** @type {Record<number|string, boolean>} */
  const next = {};
  for (let i = 0; i < BEHAVIOR_CHECKLIST_ITEMS.length; i++) {
    next[i] = false;
  }
  next.completion = false;
  next.reintegration = false;
  return next;
}

/** Checklist state for “all non-intervention tiles through `stageNumber` checked” (intervention tiles never checked). */
export function buildBehaviorChecksForStage(stageNumber) {
  const normalizedStage = Math.max(1, Math.min(50, Number(stageNumber) || 1));
  /** @type {Record<number|string, boolean>} */
  const next = {};
  for (let i = 0; i < BEHAVIOR_CHECKLIST_ITEMS.length; i++) {
    if (!isInterventionLabel(BEHAVIOR_CHECKLIST_ITEMS[i])) {
      next[i] = i + 1 <= normalizedStage;
    } else {
      next[i] = false;
    }
  }
  next.completion = false;
  next.reintegration = false;
  return next;
}

function normalizeFailedInterventionMap(raw) {
  if (!raw || typeof raw !== 'object') return {};
  /** @type {Record<number, boolean>} */
  const out = {};
  Object.keys(raw).forEach((k) => {
    const n = Number(k);
    if (Number.isFinite(n) && raw[k]) out[n] = true;
  });
  return out;
}

/** @param {Record<number, boolean>} failed */
function persistFailedSteps(persistenceId, failed) {
  if (persistenceId == null || String(persistenceId).trim() === '') return;
  const profiles = loadLadderProfiles();
  const id = String(persistenceId);
  profiles[id] = {
    ...(profiles[id] || {}),
    failedInterventionSteps: failed,
    updatedAt: new Date().toISOString(),
  };
  saveLadderProfiles(profiles);
}

function interventionBadgeStatus(n, isInterventionTile, boardPos, failedMap) {
  if (!isInterventionTile) return 'pending';
  if (failedMap[n]) return 'failed';
  if (boardPos === n) return 'current';
  if (boardPos > n) return 'passed';
  return 'upcoming';
}

/** Intervention demotion slides — click tile when the patient piece is on `from` to demote to `to`. */
const SNAKES = [
  { from: 49, to: 39 },
  { from: 45, to: 28 },
  { from: 43, to: 27 },
  { from: 31, to: 19 },
  { from: 23, to: 9 },
  { from: 19, to: 15 },
  { from: 33, to: 17 },
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
  intervention: { label: 'Intervention', border: '#DC2626' },
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

/**
 * @param {Object} props
 * @param {Record<number|string, boolean>} props.checked
 * @param {(updater: (prev: Record<number|string, boolean>) => Record<number|string, boolean>) => void} props.setChecked
 * @param {string} props.patientName
 * @param {boolean} [props.embedded] — hide header/name when nested in clinical layout
 * @param {number} [props.boardPosition] — ladder slot (1–50) when controlled by parent; not shown on the board
 * @param {(n: number) => void} [props.onBoardPositionChange] — called after intervention demotion moves the ladder position
 * @param {string|null} [props.persistenceId] — resident id: persist failed-intervention markers in ladder profile
 * @param {boolean} [props.readOnly] — when true, board is view-only (no checkboxes, demotion, completion, or reintegration)
 */
const COMPLETION_MODAL_BODY =
  'All checkable milestones will be checked except Reintegration. Intervention tiles have no checkbox. Recovery progress will show 100%.';

const UNCHECK_COMPLETION_MODAL_BODY =
  'This will remove completion and uncheck every milestone on the board (including Reintegration). Recovery progress will return to 0%.';

const INTERVENTION_DEMOTION_MODAL_BODY =
  'Intervention triggered. The patient will move back to a previous stage.';

const REINTEGRATION_MODAL_Z = 10052;

export default function BehaviorProgressBoard({
  checked,
  setChecked,
  patientName,
  embedded = false,
  boardPosition: boardPositionProp,
  onBoardPositionChange,
  persistenceId = null,
  readOnly = false,
}) {
  /** null | 'complete' — mark all | 'clear' — uncheck all */
  const [completionModalMode, setCompletionModalMode] = useState(null);
  /** null | 1 — first sure? | 2 — final confirm */
  const [reintegrationModalStep, setReintegrationModalStep] = useState(null);
  /** Pending intervention demotion after user confirms */
  const [pendingInterventionDemotion, setPendingInterventionDemotion] = useState(null);
  /** Second-step confirmation for intervention demotion */
  const [interventionSecondConfirm, setInterventionSecondConfirm] = useState(false);
  /** @type {Record<number, boolean>} */
  const [failedInterventionSteps, setFailedInterventionSteps] = useState({});

  const [internalBoardPosition, setInternalBoardPosition] = useState(1);
  const isBoardPositionControlled =
    boardPositionProp != null && typeof onBoardPositionChange === 'function';
  const currentBoardPosition = isBoardPositionControlled
    ? Math.max(1, Math.min(50, Number(boardPositionProp) || 1))
    : internalBoardPosition;

  const setBoardPosition = (next) => {
    const v = Math.max(1, Math.min(50, Number(next) || 1));
    if (isBoardPositionControlled) onBoardPositionChange(v);
    else setInternalBoardPosition(v);
  };

  const reintegrationDisplayName =
    patientName != null && String(patientName).trim() !== '' ? String(patientName).trim() : 'this resident';

  useEffect(() => {
    if (persistenceId == null || String(persistenceId).trim() === '') {
      setFailedInterventionSteps({});
      return;
    }
    const prof = loadLadderProfiles()[String(persistenceId)];
    setFailedInterventionSteps(normalizeFailedInterventionMap(prof?.failedInterventionSteps));
  }, [persistenceId]);

  /**
   * @param {number} stageNumber
   * @param {{ markFailedFrom?: number }} [opts] — set when confirming a snake demotion (marks `from` as failed/red).
   */
  const applyStageProgress = (stageNumber, opts = {}) => {
    if (readOnly) return;
    const normalizedStage = Math.max(1, Math.min(50, Number(stageNumber) || 1));
    const markFailedFrom = opts.markFailedFrom;
    setFailedInterventionSteps((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        const stepNum = Number(k);
        if (normalizedStage > stepNum) delete next[stepNum];
      });
      if (markFailedFrom != null) next[markFailedFrom] = true;
      persistFailedSteps(persistenceId, next);
      return next;
    });
    setChecked(() => buildBehaviorChecksForStage(normalizedStage));
    setBoardPosition(normalizedStage);
  };

  /** Checkbox: check → progress through n; uncheck → progress through n−1 (min 1). */
  const handleMilestoneCheckboxChange = (n) => (e) => {
    if (readOnly) {
      e.preventDefault();
      return;
    }
    const want = e.target.checked;
    if (want) {
      applyStageProgress(n);
    } else {
      applyStageProgress(Math.max(1, n - 1));
    }
  };

  const applyCompletionConfirmed = () => {
    if (readOnly) return;
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
    if (readOnly) return;
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

  /** Full reset: all milestones off, 0% progress, ladder position 1, intervention failure markers cleared. */
  const resetLadderFullyForReintegration = () => {
    if (readOnly) return;
    persistFailedSteps(persistenceId, {});
    setFailedInterventionSteps({});
    setChecked((prev) => {
      const next = { ...prev };
      for (let i = 0; i < BEHAVIOR_CHECKLIST_ITEMS.length; i++) {
        next[i] = false;
      }
      next.completion = false;
      next.reintegration = false;
      return next;
    });
    setBoardPosition(1);
  };

  const closeCompletionModal = () => setCompletionModalMode(null);
  const closeReintegrationModal = () => setReintegrationModalStep(null);
  const confirmReintegrationStep1 = () => {
    if (readOnly) return;
    setReintegrationModalStep(2);
  };
  const confirmReintegrationFinal = () => {
    if (readOnly) return;
    resetLadderFullyForReintegration();
    setReintegrationModalStep(null);
  };

  const confirmCompletionModal = () => {
    if (readOnly) return;
    if (completionModalMode === 'complete') {
      applyCompletionConfirmed();
    } else if (completionModalMode === 'clear') {
      clearAllMilestoneChecks();
    }
    setCompletionModalMode(null);
  };

  useEffect(() => {
    if (!completionModalMode && !pendingInterventionDemotion && reintegrationModalStep == null) return;
    const onKey = (ev) => {
      if (ev.key === 'Escape') {
        setCompletionModalMode(null);
        setPendingInterventionDemotion(null);
        setReintegrationModalStep(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [completionModalMode, pendingInterventionDemotion, reintegrationModalStep]);

  const confirmInterventionDemotion = () => {
    if (readOnly) return;
    if (!pendingInterventionDemotion) return;
    if (!interventionSecondConfirm) {
      setInterventionSecondConfirm(true);
      return;
    }
    const { from, to } = pendingInterventionDemotion;
    applyStageProgress(to, { markFailedFrom: from });
    setInterventionSecondConfirm(false);
    setPendingInterventionDemotion(null);
  };

  const closeInterventionDemotionModal = () => {
    setInterventionSecondConfirm(false);
    setPendingInterventionDemotion(null);
  };

  const handleCompletionButtonClick = () => {
    if (readOnly) return;
    if (!checked.completion) {
      setCompletionModalMode('complete');
      return;
    }
    setCompletionModalMode('clear');
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
                      <button
                        type="button"
                        onClick={handleCompletionButtonClick}
                        disabled={readOnly}
                        aria-pressed={!!checked.completion}
                        aria-label={checked.completion ? 'Remove completion and reset ladder' : 'Mark program completion'}
                        style={{
                          marginTop: 'auto',
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: 6,
                          border: `2px solid ${t.border}`,
                          background: checked.completion ? `${t.border}18` : '#FFFFFF',
                          color: '#1e293b',
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: readOnly ? 'not-allowed' : 'pointer',
                          opacity: readOnly ? 0.55 : 1,
                          fontFamily: 'inherit',
                          lineHeight: 1.2,
                        }}
                      >
                        {checked.completion ? 'Remove' : 'Mark complete'}
                      </button>
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
                      <button
                        type="button"
                        onClick={() => {
                          if (!readOnly) setReintegrationModalStep(1);
                        }}
                        disabled={readOnly}
                        aria-haspopup="dialog"
                        aria-expanded={reintegrationModalStep != null}
                        aria-label="Reintegrate resident — confirmation required"
                        style={{
                          marginTop: 'auto',
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: 6,
                          border: `2px solid ${t.border}`,
                          background: '#FFFFFF',
                          color: '#1e293b',
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: readOnly ? 'not-allowed' : 'pointer',
                          opacity: readOnly ? 0.55 : 1,
                          fontFamily: 'inherit',
                          lineHeight: 1.2,
                        }}
                      >
                        Reintegrate
                      </button>
                    </div>
                  );
                }

                const n = cell.n;
                const label = BEHAVIOR_CHECKLIST_ITEMS[n - 1];
                const isInterventionTile = isInterventionLabel(label);
                const tierKey = isInterventionTile ? 'intervention' : tierForSquare(n);
                const t = TIERS[tierKey];
                const snake = SNAKES.find((s) => s.from === n);
                const idx = n - 1;
                const tileWeightPct = PERCENT_WEIGHT_BY_INDEX[idx];
                const badgeStatus = interventionBadgeStatus(n, isInterventionTile, currentBoardPosition, failedInterventionSteps);
                const demotionBadgeStatus = snake
                  ? interventionBadgeStatus(snake.from, true, currentBoardPosition, failedInterventionSteps)
                  : 'upcoming';
                const openDemotionModal = () => {
                  if (readOnly) return;
                  if (!snake) return;
                  setInterventionSecondConfirm(false);
                  setPendingInterventionDemotion({ from: snake.from, to: snake.to });
                };

                return (
                  <div
                    key={`${ri}-${ci}-${n}`}
                    onClick={(e) => {
                      if (readOnly) return;
                      const el = e.target;
                      if (el instanceof Element && el.closest('input[type="checkbox"], button')) return;
                      if (el instanceof Element && el.closest('[data-intervention-demotion]')) return;

                      if (snake && isInterventionTile) {
                        openDemotionModal();
                        return;
                      }
                      if (!isInterventionTile) {
                        applyStageProgress(n);
                      }
                    }}
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
                      cursor: readOnly ? 'default' : !isInterventionTile || snake ? 'pointer' : undefined,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 6,
                        width: '100%',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, minWidth: 0 }}>
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
                            disabled={readOnly}
                            onClick={(e) => e.stopPropagation()}
                            onChange={handleMilestoneCheckboxChange(n)}
                            aria-label={`Square ${n}`}
                            style={{
                              width: 14,
                              height: 14,
                              accentColor: t.border,
                              cursor: readOnly ? 'not-allowed' : 'pointer',
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </div>
                      {snake && !isInterventionTile ? (
                        <button
                          type="button"
                          data-intervention-demotion
                          disabled={readOnly}
                          onClick={(e) => {
                            e.stopPropagation();
                            openDemotionModal();
                          }}
                          style={{
                            flexShrink: 0,
                            fontSize: 8,
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            color:
                              demotionBadgeStatus === 'current'
                                ? '#854D0E'
                                : demotionBadgeStatus === 'passed'
                                  ? '#166534'
                                  : demotionBadgeStatus === 'failed'
                                    ? '#991B1B'
                                    : '#991B1B',
                            background:
                              demotionBadgeStatus === 'current'
                                ? '#FEF9C3'
                                : demotionBadgeStatus === 'passed'
                                  ? '#ECFDF3'
                                  : demotionBadgeStatus === 'failed'
                                    ? '#FEE2E2'
                                    : '#FEF2F2',
                            border: `1px solid ${
                              demotionBadgeStatus === 'current'
                                ? '#EAB308'
                                : demotionBadgeStatus === 'passed'
                                  ? '#22C55E'
                                  : demotionBadgeStatus === 'failed'
                                    ? '#EF4444'
                                    : '#DC2626'
                            }`,
                            borderRadius: 4,
                            padding: '3px 6px',
                            cursor: readOnly ? 'not-allowed' : 'pointer',
                            opacity: readOnly ? 0.55 : 1,
                            lineHeight: 1.2,
                          }}
                        >
                          Intervention
                        </button>
                      ) : null}
                    </div>
                    <div style={{ flex: 1, minHeight: 0, lineHeight: 1.3, overflow: 'hidden' }}>
                      {renderBehaviorChecklistLabel(label, badgeStatus)}
                    </div>
                    <div
                      style={{
                        position: 'absolute',
                        right: 6,
                        bottom: 4,
                        textAlign: 'right',
                        lineHeight: 1.15,
                      }}
                    >
                      {tileWeightPct != null ? (
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                          {`${tileWeightPct.toFixed(2)}%`}
                        </div>
                      ) : null}
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: 13,
                          fontWeight: 800,
                          color: '#0F172A',
                          fontVariantNumeric: 'tabular-nums',
                          letterSpacing: '-0.02em',
                          background: 'linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%)',
                          border: '1px solid #CBD5E1',
                          borderRadius: 6,
                          padding: '3px 9px',
                          minWidth: 28,
                          boxShadow: '0 1px 0 rgba(15, 23, 42, 0.06)',
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
      </div>

      {pendingInterventionDemotion
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="intervention-demotion-modal-title"
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10051,
                background: 'rgba(15, 23, 42, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 20,
              }}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) closeInterventionDemotionModal();
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
                  id="intervention-demotion-modal-title"
                  style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 800, color: '#1B2559' }}
                >
                  {interventionSecondConfirm ? 'Confirm Demotion' : 'Intervention'}
                </h2>
                <p style={{ margin: '0 0 22px', fontSize: 13, color: '#64748B', lineHeight: 1.55 }}>
                  {interventionSecondConfirm
                    ? `Do you really want to demote this resident to stage ${pendingInterventionDemotion.to}?`
                    : INTERVENTION_DEMOTION_MODAL_BODY}
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={closeInterventionDemotionModal}
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
                    onClick={confirmInterventionDemotion}
                    style={{
                      padding: '10px 22px',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#fff',
                      background: TIERS.intervention.border,
                      border: 'none',
                      borderRadius: 10,
                      cursor: 'pointer',
                    }}
                  >
                    {interventionSecondConfirm ? 'Confirm' : 'OK'}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {reintegrationModalStep != null
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="reintegration-modal-title"
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: REINTEGRATION_MODAL_Z,
                background: 'rgba(15, 23, 42, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 20,
              }}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) closeReintegrationModal();
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
                  id="reintegration-modal-title"
                  style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 800, color: '#1B2559' }}
                >
                  {reintegrationModalStep === 1 ? 'Reintegrate resident?' : 'Confirm reintegration'}
                </h2>
                <p style={{ margin: '0 0 22px', fontSize: 13, color: '#64748B', lineHeight: 1.55 }}>
                  {reintegrationModalStep === 1 ? (
                    <>
                      Are you sure you want to reintegrate{' '}
                      <strong style={{ color: '#1e293b' }}>{reintegrationDisplayName}</strong>? You will be asked to
                      confirm again before anything changes.
                    </>
                  ) : (
                    <>
                      Final confirmation: this will clear every milestone on the recovery ladder for{' '}
                      <strong style={{ color: '#1e293b' }}>{reintegrationDisplayName}</strong>, reset ladder position to
                      the start, and remove intervention flags. Recovery progress will return to{' '}
                      <strong style={{ color: '#1e293b' }}>0%</strong>.
                    </>
                  )}
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={closeReintegrationModal}
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
                    onClick={reintegrationModalStep === 1 ? confirmReintegrationStep1 : confirmReintegrationFinal}
                    style={{
                      padding: '10px 18px',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#fff',
                      background: TIERS.reintegration.border,
                      border: 'none',
                      borderRadius: 10,
                      cursor: 'pointer',
                    }}
                  >
                    {reintegrationModalStep === 1 ? 'Yes, continue' : 'Confirm'}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

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
