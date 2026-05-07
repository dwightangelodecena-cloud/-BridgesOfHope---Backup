const LADDER_PROFILE_KEY = 'bh_recovery_ladder_profiles_v1';

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function loadLadderProfiles() {
  const raw = readJson(LADDER_PROFILE_KEY, {});
  return raw && typeof raw === 'object' ? raw : {};
}

export function saveLadderProfiles(map) {
  localStorage.setItem(LADDER_PROFILE_KEY, JSON.stringify(map || {}));
}
