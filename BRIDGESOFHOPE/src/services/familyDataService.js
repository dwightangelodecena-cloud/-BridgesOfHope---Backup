const parseJsonArray = (raw, fallback = []) => {
  try {
    const parsed = JSON.parse(raw || 'null');
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

export const familyDataService = {
  getRequestsSummary() {
    const admissions = parseJsonArray(localStorage.getItem('bh_pending_admissions'));
    const discharges = parseJsonArray(localStorage.getItem('bh_pending_discharges'));
    return {
      admissions: admissions.length,
      discharges: discharges.length,
      total: admissions.length + discharges.length,
    };
  },

  getNotifications() {
    return parseJsonArray(localStorage.getItem('bh_family_notifications'), []);
  },

  getProfileSnapshot() {
    const profileRaw = localStorage.getItem('bh_family_profile');
    if (!profileRaw) {
      return { fullName: 'Family User', email: '', phone: '', address: '' };
    }
    try {
      return JSON.parse(profileRaw);
    } catch {
      return { fullName: 'Family User', email: '', phone: '', address: '' };
    }
  },

  getBillingSnapshot() {
    return {
      outstanding: 35000,
      nextDue: 'Apr 30, 2026',
      status: 'Pending',
    };
  },
};
