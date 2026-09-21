export const INTERVENTION_SUFFIX = ' — Intervention';

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

export const PERCENT_WEIGHT_BY_INDEX = buildPercentWeightByIndex(BEHAVIOR_CHECKLIST_ITEMS);

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
