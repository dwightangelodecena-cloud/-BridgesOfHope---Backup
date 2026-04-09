/**
 * Canonical fee amounts from `src/pages/family/service.jsx` (Fees & Inclusions).
 * Do not invent prices elsewhere — import from here.
 */
export const ADMISSION_FEE_PHP = 30_000;

/** Monthly residential fee by branch (same labels as service.jsx). */
export const MONTHLY_FEE_BY_BRANCH = {
  imus: 35_000,
  amadeo: 33_000,
};

export const BRANCH_LABEL = {
  imus: 'Imus Branch',
  amadeo: 'Amadeo Branch',
};

/** Select keys for UI / stored values. */
export const BRANCH_KEYS = ['imus', 'amadeo'];

/**
 * @param {{ branch?: keyof typeof MONTHLY_FEE_BY_BRANCH | ''; monthsOfCare?: number; includeAdmissionFee?: boolean; includeMonthly?: boolean }} opts
 */
export function computeTotalServiceCostPhp(opts) {
  const {
    branch = 'imus',
    monthsOfCare = 1,
    includeAdmissionFee = true,
    includeMonthly = true,
  } = opts || {};
  let total = 0;
  if (includeAdmissionFee) total += ADMISSION_FEE_PHP;
  if (includeMonthly && branch && MONTHLY_FEE_BY_BRANCH[branch] != null) {
    const m = Math.max(0, Number(monthsOfCare) || 0);
    total += MONTHLY_FEE_BY_BRANCH[branch] * m;
  }
  return total;
}

export function formatPhp(amount) {
  const n = Number(amount);
  if (Number.isNaN(n)) return '₱0';
  return `₱${n.toLocaleString('en-PH')}`;
}
