import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronRight, MapPin, Trophy, Undo2 } from 'lucide-react';
import { loadLadderProfiles, saveLadderProfiles } from '@/lib/recoveryLadderStorage';
import {
  isInterventionLabel,
  BEHAVIOR_CHECKLIST_ITEMS,
  PERCENT_WEIGHT_BY_INDEX,
  INTERVENTION_SUFFIX,
  buildBehaviorChecksForStage,
  computeBehaviorBoardProgressPercent,
} from '@/lib/behaviorChecklist';
import { renderBehaviorChecklistLabel } from '@/lib/renderBehaviorChecklistLabel';

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

/** Space between tiles; path connectors are drawn inside it. */
const BOARD_GAP = 16;

/** Square number → { row, col } in DISPLAY_ROWS, used to draw path connectors. */
const SQUARE_POS = (() => {
  /** @type {Record<number, { row: number, col: number }>} */
  const out = {};
  DISPLAY_ROWS.forEach((row, ri) =>
    row.forEach((cell, ci) => {
      if (cell.kind === 'square') out[cell.n] = { row: ri, col: ci };
    })
  );
  return out;
})();

/** Which way square n leads to n+1: 'right' | 'left' | 'down' | 'down-right' | 'down-left' | null (end of path). */
function pathDirection(n) {
  const a = SQUARE_POS[n];
  const b = SQUARE_POS[n + 1];
  if (!a || !b) return null;
  if (b.row > a.row) {
    if (b.col === a.col) return 'down';
    return b.col > a.col ? 'down-right' : 'down-left';
  }
  return b.col > a.col ? 'right' : 'left';
}

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

/** 8-digit hex: tier color at low alpha, for tinted fills and focus rings. */
function tint(hex, alpha) {
  return `${hex}${alpha}`;
}

/** Pulse ring on the "you are here" tile; disabled for reduced-motion users. */
const BOARD_STATE_CSS = `
@keyframes bh-ladder-pulse {
  0% { box-shadow: 0 0 0 0 var(--bh-ladder-ring); }
  70% { box-shadow: 0 0 0 8px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}
.bh-ladder-current { animation: bh-ladder-pulse 2.2s ease-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .bh-ladder-current { animation: none; }
}
.bh-ladder-state-btn:focus-visible { outline: 2px solid #1B2559; outline-offset: 2px; }
`;

/**
 * Tile progress marker that replaces the old checkbox: filled check when done,
 * a pin when it is the resident's current stage, an empty ring when upcoming.
 * Still toggles like the checkbox did when the board is editable.
 */
function StageMarker({ state, color, n, readOnly, onToggle }) {
  const done = state === 'done' || state === 'current';
  const size = 20;
  const visual =
    state === 'current' ? (
      <span
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: color,
          color: '#fff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MapPin size={12} strokeWidth={2.75} />
      </span>
    ) : state === 'done' ? (
      <span
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: '#16A34A',
          color: '#fff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Check size={12} strokeWidth={3} />
      </span>
    ) : (
      <span
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          border: '2px dashed #CBD5E1',
          boxSizing: 'border-box',
          display: 'inline-block',
        }}
      />
    );

  const label =
    state === 'current'
      ? `Stage ${n}: current stage`
      : state === 'done'
        ? `Stage ${n}: completed`
        : `Stage ${n}: not yet reached`;

  if (readOnly) {
    return (
      <span role="img" aria-label={label} title={label} style={{ display: 'inline-flex', flexShrink: 0 }}>
        {visual}
      </span>
    );
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      title={done ? `Uncheck to move back to stage ${Math.max(1, n - 1)}` : `Mark progress through stage ${n}`}
      className="bh-ladder-state-btn"
      onClick={(e) => {
        e.stopPropagation();
        onToggle(!done);
      }}
      style={{
        display: 'inline-flex',
        flexShrink: 0,
        padding: 0,
        border: 'none',
        background: 'none',
        borderRadius: '50%',
        cursor: 'pointer',
      }}
    >
      {visual}
    </button>
  );
}

/** Rotation of the right-pointing connector for each path direction. */
const CONNECTOR_ROTATION = { right: 0, 'down-right': 45, down: 90, 'down-left': 135, left: 180 };

/**
 * Flow-chart connector drawn in the gap after a tile, pointing at the next stage.
 * walked = path already travelled (solid green), next = current → next stage (tier color),
 * ahead = not reached yet (dashed slate).
 */
function PathConnector({ direction, variant, color }) {
  const stroke = variant === 'walked' ? '#16A34A' : variant === 'next' ? color : '#A3B1C2';
  const len = BOARD_GAP + 6;
  const placement =
    direction === 'down'
      ? { left: '50%', bottom: -BOARD_GAP / 2 }
      : direction === 'left'
        ? { top: '50%', left: -BOARD_GAP / 2 }
        : direction === 'right'
          ? { top: '50%', right: -BOARD_GAP / 2 }
          : direction === 'down-right'
            ? { right: -BOARD_GAP / 2, bottom: -BOARD_GAP / 2 }
            : { left: -BOARD_GAP / 2, bottom: -BOARD_GAP / 2 };
  return (
    <svg
      aria-hidden
      width={len}
      height={12}
      viewBox={`0 0 ${len} 12`}
      style={{
        position: 'absolute',
        ...placement,
        zIndex: 2,
        overflow: 'visible',
        pointerEvents: 'none',
        transform: `translate(${placement.right != null ? '50%' : '-50%'}, ${placement.bottom != null ? '50%' : '-50%'}) rotate(${CONNECTOR_ROTATION[direction]}deg)`,
      }}
    >
      <line
        x1={1}
        y1={6}
        x2={len - 6}
        y2={6}
        stroke={stroke}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray={variant === 'ahead' ? '2.5 3' : undefined}
      />
      <path
        d={`M${len - 8} 1.5 L${len - 1} 6 L${len - 8} 10.5 Z`}
        fill={stroke}
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Pill shown on the tile the resident currently stands on. */
function YouAreHerePill({ color }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize: 8,
        fontWeight: 800,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: '#fff',
        background: color,
        borderRadius: 999,
        padding: '3px 7px',
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
      }}
    >
      You are here
    </span>
  );
}

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

  // Re-derive failed-intervention markers whenever the resident changes (React-recommended
  // "adjust state when a prop changes" pattern — see react.dev/learn/you-might-not-need-an-effect).
  const [failedStepsKey, setFailedStepsKey] = useState(persistenceId);
  if (persistenceId !== failedStepsKey) {
    setFailedStepsKey(persistenceId);
    const hasId = persistenceId != null && String(persistenceId).trim() !== '';
    const prof = hasId ? loadLadderProfiles()[String(persistenceId)] : null;
    setFailedInterventionSteps(normalizeFailedInterventionMap(prof?.failedInterventionSteps));
  }

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

  /** Stage marker: mark → progress through n; unmark → progress through n−1 (min 1). */
  const handleMilestoneToggle = (n) => (want) => {
    if (readOnly) return;
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

  /** Tile (or Completion cell) the resident stands on; centred horizontally when the board scrolls sideways. */
  const currentTileRef = useRef(null);
  const completionFlag = !!checked.completion;
  useEffect(() => {
    const tile = currentTileRef.current;
    if (!tile) return;
    let scroller = tile.parentElement;
    while (scroller && scroller.scrollWidth <= scroller.clientWidth + 1) scroller = scroller.parentElement;
    if (!scroller || scroller === document.body || scroller === document.documentElement) return;
    const tileBox = tile.getBoundingClientRect();
    const scrollerBox = scroller.getBoundingClientRect();
    const offset = tileBox.left - scrollerBox.left - (scrollerBox.width - tileBox.width) / 2;
    scroller.scrollBy({ left: offset, behavior: 'smooth' });
  }, [currentBoardPosition, completionFlag]);

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

  const isCompleted = !!checked.completion;
  const progressPct = isCompleted ? 100 : computeBehaviorBoardProgressPercent(checked);
  const currentLabelRaw = BEHAVIOR_CHECKLIST_ITEMS[currentBoardPosition - 1] ?? '';
  const currentLabel = currentLabelRaw.endsWith(INTERVENTION_SUFFIX)
    ? currentLabelRaw.slice(0, -INTERVENTION_SUFFIX.length)
    : currentLabelRaw;
  const currentTier = isCompleted
    ? TIERS.completion
    : TIERS[isInterventionLabel(currentLabelRaw) ? 'intervention' : tierForSquare(currentBoardPosition)];

  /** Next checkable milestone after the current stage (interventions are skipped). */
  let nextStage = null;
  for (let m = currentBoardPosition + 1; m <= BEHAVIOR_CHECKLIST_ITEMS.length; m++) {
    if (!isInterventionLabel(BEHAVIOR_CHECKLIST_ITEMS[m - 1])) {
      nextStage = { n: m, label: BEHAVIOR_CHECKLIST_ITEMS[m - 1] };
      break;
    }
  }

  /** done | current | upcoming for a numbered square. */
  const squareState = (n, idx) => {
    if (isCompleted) return 'done';
    if (n === currentBoardPosition) return 'current';
    if (checked[idx] || n < currentBoardPosition) return 'done';
    return 'upcoming';
  };

  return (
    <div>
      <style>{BOARD_STATE_CSS}</style>

      <div
        aria-live="polite"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 16,
          marginBottom: 14,
          padding: '14px 16px',
          borderRadius: 12,
          background: tint(currentTier.border, '0F'),
          border: `1px solid ${tint(currentTier.border, '40')}`,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: currentTier.border,
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {isCompleted ? <Trophy size={20} /> : <MapPin size={20} />}
        </span>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: currentTier.border,
            }}
          >
            {isCompleted ? 'Program completed' : `Current stage · ${currentTier.label}`}
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginTop: 2, lineHeight: 1.3 }}>
            {isCompleted ? 'All milestones reached' : `Stage ${currentBoardPosition} of 50 — ${currentLabel}`}
          </div>
          {!isCompleted ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                fontWeight: 600,
                color: '#64748B',
                marginTop: 4,
                lineHeight: 1.35,
              }}
            >
              <ChevronRight size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} aria-hidden />
              <span>
                <span style={{ fontWeight: 700, color: '#334155' }}>Next:</span>{' '}
                {nextStage ? `Stage ${nextStage.n} — ${nextStage.label}` : 'Program completion'}
              </span>
            </div>
          ) : null}
        </div>
        <div style={{ flex: '1 1 200px', minWidth: 160 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              fontWeight: 700,
              color: '#475569',
              marginBottom: 6,
            }}
          >
            <span>Recovery progress</span>
            <span style={{ color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>{progressPct.toFixed(0)}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progressPct)}
            aria-label="Recovery progress"
            style={{ height: 8, borderRadius: 999, background: '#E2E8F0', overflow: 'hidden' }}
          >
            <div
              style={{
                width: `${progressPct}%`,
                height: '100%',
                borderRadius: 999,
                background: currentTier.border,
                transition: 'width 300ms ease-out',
              }}
            />
          </div>
        </div>
      </div>

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
          gap: BOARD_GAP,
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
                      ref={isCompleted ? currentTileRef : undefined}
                      className={isCompleted ? 'bh-ladder-current' : undefined}
                      style={{
                        '--bh-ladder-ring': tint(t.border, '55'),
                        minHeight: 96,
                        height: '100%',
                        borderRadius: 8,
                        background: isCompleted ? tint(t.border, '14') : TILE_FILL,
                        border: `${isCompleted ? 3 : 2}px solid ${t.border}`,
                        padding: 8,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 4,
                        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
                      }}
                    >
                      {isCompleted ? <YouAreHerePill color={t.border} /> : null}
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
                const state = squareState(n, idx);
                const isCurrent = state === 'current';
                const isUpcoming = state === 'upcoming';
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
                    ref={isCurrent ? currentTileRef : undefined}
                    className={isCurrent ? 'bh-ladder-current' : undefined}
                    aria-current={isCurrent ? 'step' : undefined}
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
                      '--bh-ladder-ring': tint(t.border, '55'),
                      position: 'relative',
                      minHeight: 96,
                      height: '100%',
                      borderRadius: 8,
                      background: isCurrent
                        ? tint(t.border, '14')
                        : state === 'done' && !isInterventionTile
                          ? '#F7FEF9'
                          : TILE_FILL,
                      border: `${isCurrent ? 3 : 2}px solid ${t.border}`,
                      padding: isCurrent ? '7px 7px 25px' : '8px 8px 26px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                      zIndex: isCurrent ? 1 : undefined,
                      cursor: readOnly ? 'default' : !isInterventionTile || snake ? 'pointer' : undefined,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 6,
                        width: '100%',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        {isInterventionTile ? (
                          <span
                            style={{ width: 20, height: 20, flexShrink: 0 }}
                            aria-hidden
                            title="Observation only — no checklist"
                          />
                        ) : (
                          <StageMarker
                            state={state}
                            color={t.border}
                            n={n}
                            readOnly={readOnly}
                            onToggle={handleMilestoneToggle(n)}
                          />
                        )}
                        {isCurrent ? <YouAreHerePill color={t.border} /> : null}
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
                    <div
                      style={{
                        flex: 1,
                        minHeight: 0,
                        lineHeight: 1.3,
                        overflow: 'hidden',
                        opacity: isUpcoming && !isInterventionTile ? 0.6 : 1,
                      }}
                    >
                      {renderBehaviorChecklistLabel(label, badgeStatus)}
                      {snake && isInterventionTile ? (
                        <div
                          title={`If triggered, the resident moves back to stage ${snake.to}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            marginTop: 5,
                            fontSize: 10,
                            fontWeight: 600,
                            color: '#94A3B8',
                          }}
                        >
                          <Undo2 size={11} strokeWidth={2.5} aria-hidden />
                          Sends back to {snake.to}
                        </div>
                      ) : null}
                    </div>
                    {pathDirection(n) ? (
                      <PathConnector
                        direction={pathDirection(n)}
                        variant={isCurrent ? 'next' : state === 'done' ? 'walked' : 'ahead'}
                        color={t.border}
                      />
                    ) : null}
                    <div
                      style={{
                        position: 'absolute',
                        right: 6,
                        bottom: 4,
                        textAlign: 'right',
                        lineHeight: 1.15,
                      }}
                    >
                      <span
                        title={
                          tileWeightPct != null
                            ? `Stage ${n} · worth ${tileWeightPct.toFixed(2)}% of recovery progress`
                            : `Stage ${n} · observation only`
                        }
                        style={{
                          display: 'inline-block',
                          fontSize: 13,
                          fontWeight: 800,
                          color: isCurrent ? '#FFFFFF' : '#0F172A',
                          fontVariantNumeric: 'tabular-nums',
                          letterSpacing: '-0.02em',
                          background: isCurrent ? t.border : 'linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%)',
                          border: `1px solid ${isCurrent ? t.border : '#CBD5E1'}`,
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
        <span aria-hidden style={{ width: 1, height: 16, background: '#E2E8F0' }} />
        {[
          { key: 'done', label: 'Completed' },
          { key: 'current', label: 'You are here' },
          { key: 'upcoming', label: 'Not yet reached' },
        ].map(({ key, label }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span aria-hidden style={{ display: 'inline-flex' }}>
              <StageMarker state={key} color={currentTier.border} n={0} readOnly />
            </span>
            <span style={{ fontWeight: 600, color: '#475569' }}>{label}</span>
          </div>
        ))}
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
