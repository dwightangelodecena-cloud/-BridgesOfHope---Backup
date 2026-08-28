/**
 * Deterministic active-caseload counting for the staff-assignment recommendation UI.
 * No AI/LLM involved — pure counting + sort, per the capstone requirement that
 * assignment logic must use deterministic business rules, not arbitrary AI decisions.
 */

/**
 * @param {object[]} patients rows with `assigned_nurse_id`/`assigned_program_staff_id` and `discharged_at`
 * @param {'assigned_nurse_id'|'assigned_program_staff_id'} idField
 * @returns {Map<string, number>} profileId -> count of active (non-discharged) patients
 */
export function computeActiveCaseloadCounts(patients, idField) {
  const counts = new Map();
  for (const p of patients || []) {
    if (p?.discharged_at) continue;
    const id = p?.[idField];
    if (!id) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  return counts;
}

/**
 * Sorts candidates ascending by active caseload (lowest workload first = recommended).
 * Ties broken alphabetically by name for a stable, predictable order.
 * @param {Array<{id: string, name: string}>} candidates
 * @param {Map<string, number>} counts
 * @returns {Array<{id: string, name: string, activeCount: number, recommended: boolean}>}
 */
export function rankCandidatesByWorkload(candidates, counts) {
  const ranked = (candidates || []).map((c) => ({
    ...c,
    activeCount: counts.get(c.id) || 0,
  }));
  ranked.sort((a, b) => a.activeCount - b.activeCount || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  const lowest = ranked.length ? ranked[0].activeCount : 0;
  return ranked.map((c) => ({ ...c, recommended: c.activeCount === lowest }));
}
