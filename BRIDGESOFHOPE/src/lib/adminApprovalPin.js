const ADMIN_APPROVAL_PIN_STORAGE_PREFIX = 'bh_admin_approval_pin_v1:';

function keyForUser(userId) {
  return `${ADMIN_APPROVAL_PIN_STORAGE_PREFIX}${String(userId || 'global')}`;
}

export function getAdminApprovalPin(userId) {
  return localStorage.getItem(keyForUser(userId)) || '';
}

export function setAdminApprovalPin(userId, pin) {
  localStorage.setItem(keyForUser(userId), String(pin));
}

export function clearAdminApprovalPin(userId) {
  localStorage.removeItem(keyForUser(userId));
}

export function resolveAdminApprovalPin(userId, envPin = '') {
  const saved = getAdminApprovalPin(userId);
  if (saved) return saved;
  return envPin ? String(envPin) : '';
}

export function verifyAdminApprovalPin(inputPin, userId, envPin = '') {
  const required = resolveAdminApprovalPin(userId, envPin);
  if (!required) return true;
  return String(inputPin) === String(required);
}
