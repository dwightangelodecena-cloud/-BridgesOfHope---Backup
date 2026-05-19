/** Lightweight forecasting from historical patient & request data (no external ML). */

const DAY_MS = 24 * 60 * 60 * 1000;

function parseTs(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

function startOfDayMs(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function linearRegression(points) {
  const n = points.length;
  if (!n) return { slope: 0, intercept: 0 };
  if (n === 1) return { slope: 0, intercept: points[0].y };
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
  }
  const denom = n * sumXX - sumX * sumX;
  const slope = denom ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function forecastValue(model, x) {
  return Math.max(0, Math.round(model.intercept + model.slope * x));
}

function isInCareAt(patients, dayMs) {
  const endOfDay = dayMs + DAY_MS - 1;
  return patients.filter((p) => {
    const adm = parseTs(p.admitted_at || p.admissionDate || p.admittedAt);
    if (!adm || adm > endOfDay) return false;
    const dis = parseTs(p.discharged_at || p.dischargedAt);
    if (dis && dis <= dayMs) return false;
    return true;
  }).length;
}

function buildDailyOccupancy(patients, daysBack = 90) {
  const today = startOfDayMs();
  const series = [];
  for (let i = daysBack; i >= 0; i -= 1) {
    const dayMs = today - i * DAY_MS;
    series.push({
      date: new Date(dayMs).toISOString().slice(0, 10),
      value: isInCareAt(patients, dayMs),
    });
  }
  return series;
}

function weeklyAdmissionCounts(admissionRequests, weeks = 12) {
  const now = Date.now();
  const buckets = Array.from({ length: weeks }, () => 0);
  (admissionRequests || []).forEach((r) => {
    const t = parseTs(r.created_at || r.createdAt || r.requestTime);
    if (!t || t < now - weeks * 7 * DAY_MS) return;
    const weekIdx = Math.floor((now - t) / (7 * DAY_MS));
    if (weekIdx >= 0 && weekIdx < weeks) buckets[weeks - 1 - weekIdx] += 1;
  });
  return buckets;
}

function avgStayDays(patients) {
  const stays = (patients || [])
    .map((p) => {
      const a = parseTs(p.admitted_at || p.admissionDate || p.admittedAt);
      if (!a) return null;
      const d = parseTs(p.discharged_at || p.dischargedAt) || Date.now();
      return Math.max(1, Math.ceil((d - a) / DAY_MS));
    })
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!stays.length) return 30;
  return Math.round(stays.reduce((s, n) => s + n, 0) / stays.length);
}

/** Estimate likely discharges per day from stay length, history, and pending requests. */
function buildDailyDischargeForecast(patients, pendingDischarges, avgStay) {
  const inCare = (patients || []).filter((p) => !parseTs(p.discharged_at || p.dischargedAt));
  const pending = pendingDischarges || [];
  const pendingIds = new Set(pending.map((r) => String(r.patient_id || r.patientId || '')));

  const thirtyDaysAgo = Date.now() - 30 * DAY_MS;
  const recentDischargeCount = (patients || []).filter((p) => {
    const d = parseTs(p.discharged_at || p.dischargedAt);
    return d && d >= thirtyDaysAgo;
  }).length;

  const histDaily = recentDischargeCount > 0 ? recentDischargeCount / 30 : 0;
  const steadyDaily = inCare.length / Math.max(avgStay, 14);
  const perDayAverage = Math.round((histDaily * 0.45 + steadyDaily * 0.55) * 10) / 10;
  const pendingCount = pending.length;
  const todayEstimate = Math.round((perDayAverage + pendingCount * 0.4) * 10) / 10;

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const next7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const pendingSlice = i < 3 ? pendingCount / 3 : 0;
    const estimated = Math.max(0, Math.round((perDayAverage + pendingSlice) * 10) / 10);
    return {
      dayLabel: i === 0 ? 'Today' : dayNames[d.getDay()],
      dateStr: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      estimated,
      isToday: i === 0,
    };
  });

  const candidates = inCare
    .map((p) => {
      const id = p.id;
      const name = p.full_name || p.name || p.patient_name || 'Resident';
      const adm = parseTs(p.admitted_at || p.admissionDate);
      const stayDays = adm ? Math.ceil((Date.now() - adm) / DAY_MS) : 0;
      const hasPending = pendingIds.has(String(id));
      const status = String(p.clinical_status || p.status || '').toLowerCase();
      const nearingStay = stayDays >= avgStay * 0.85;
      const improving =
        status.includes('improv') ||
        status.includes('stable') ||
        status.includes('ready') ||
        status.includes('recover');

      let probability = 0;
      if (hasPending) probability += 55;
      if (nearingStay) probability += 28;
      if (improving) probability += 18;
      if (stayDays > avgStay * 1.05) probability += 12;
      probability = Math.min(95, probability);

      if (probability < 22 && !hasPending) return null;
      return {
        id,
        name,
        stayDays,
        probability,
        hasPending,
        room: p.room || p.room_number || null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 6);

  return {
    perDayAverage,
    todayEstimate,
    next7Days,
    candidates,
    pendingCount,
    inCareCount: inCare.length,
  };
}

function buildConfidenceMeta({
  occupancyDays,
  admissionWeeksActive,
  weeklyReportCount,
  patientsInCare,
  admissionRequestCount,
}) {
  const factors = [
    {
      id: 'occupancy',
      label: 'Occupancy history',
      detail: `${occupancyDays} daily snapshots (90-day window)`,
      weight: 40,
      met: occupancyDays >= 45,
      progress: Math.min(100, Math.round((occupancyDays / 45) * 100)),
    },
    {
      id: 'admissions',
      label: 'Admission request trend',
      detail: `${admissionWeeksActive} of 12 weeks with requests`,
      weight: 30,
      met: admissionWeeksActive >= 6,
      progress: Math.min(100, Math.round((admissionWeeksActive / 6) * 100)),
    },
    {
      id: 'reports',
      label: 'Weekly clinical reports',
      detail: `${weeklyReportCount} reports on file`,
      weight: 20,
      met: weeklyReportCount >= 10,
      progress: Math.min(100, Math.round((weeklyReportCount / 10) * 100)),
    },
    {
      id: 'caseload',
      label: 'Active caseload',
      detail: `${patientsInCare} residents in care · ${admissionRequestCount} total requests`,
      weight: 10,
      met: patientsInCare >= 3,
      progress: Math.min(100, Math.round((patientsInCare / 3) * 100)),
    },
  ];

  const score = Math.round(
    factors.reduce((sum, f) => sum + (f.met ? f.weight : f.weight * (f.progress / 100)), 0),
  );

  let level = 'low';
  let label = 'Limited history';
  if (score >= 75) {
    level = 'high';
    label = 'High confidence';
  } else if (score >= 45) {
    level = 'medium';
    label = 'Moderate confidence';
  }

  return { level, label, score, factors };
}

/** Cap unrealistic timelines when trend slope is negligible. */
function daysUntilTarget(current, target, slopePerDay, maxDays = 180) {
  if (slopePerDay < 0.05 || current >= target) return null;
  const days = Math.ceil((target - current) / slopePerDay);
  if (!Number.isFinite(days) || days > maxDays) return null;
  return days;
}

/**
 * @param {object} input
 * @returns {object} Predictive insight bundle for admin dashboard
 */
export function computePredictiveInsights({
  patients = [],
  admissionRequests = [],
  pendingAdmissions = [],
  pendingDischarges = [],
  weeklyReports = [],
  bedCapacity = 50,
}) {
  const cap = Math.max(1, Number(bedCapacity) || 50);
  const inCare = (patients || []).filter((p) => !parseTs(p.discharged_at || p.dischargedAt));
  const currentOccupancy = inCare.length;

  const occupancySeries = buildDailyOccupancy(patients, 90);
  const recent = occupancySeries.slice(-30);
  const regPoints = recent.map((p, i) => ({ x: i, y: p.value }));
  const model = linearRegression(regPoints);
  const lastX = regPoints.length ? regPoints.length - 1 : 0;
  const projected14 = forecastValue(model, lastX + 14);
  const projected30 = forecastValue(model, lastX + 30);
  const trendSlope = model.slope;

  let trendLabel = 'Stable';
  if (trendSlope > 0.15) trendLabel = 'Rising';
  else if (trendSlope < -0.15) trendLabel = 'Declining';

  const weeklyAdm = weeklyAdmissionCounts(admissionRequests, 12);
  const activeWeeks = weeklyAdm.filter((n) => n > 0);
  const avgWeeklyAdmissions = activeWeeks.length
    ? Math.round(activeWeeks.reduce((s, n) => s + n, 0) / activeWeeks.length)
    : Math.round((admissionRequests || []).length / Math.max(1, 12));
  const projectedAdmissions30 = Math.max(0, Math.round(avgWeeklyAdmissions * (30 / 7)));

  const avgStay = avgStayDays(patients);
  const pendingDischargeCount = (pendingDischarges || []).length;
  const estWeeklyDischarges = Math.max(1, Math.round(inCare.length / Math.max(avgStay / 7, 4)));
  const estDaysToClearPending = pendingDischargeCount
    ? Math.ceil((pendingDischargeCount / estWeeklyDischarges) * 7)
    : 0;

  const pct = (n) => Math.min(100, Math.round((n / cap) * 100));
  const currentPct = pct(currentOccupancy);

  const target90 = Math.ceil(cap * 0.9);
  const daysTo90 = daysUntilTarget(currentOccupancy, target90, trendSlope);
  const daysToFull = daysUntilTarget(currentOccupancy, cap, trendSlope);

  let capacityRisk = 'low';
  if (projected14 >= cap || currentPct >= 95) capacityRisk = 'critical';
  else if (projected14 >= cap * 0.9 || currentPct >= 85) capacityRisk = 'high';
  else if (projected14 >= cap * 0.75 || currentPct >= 70) capacityRisk = 'medium';

  const reportByPatient = new Map();
  (weeklyReports || []).forEach((r) => {
    const pid = String(r.patient_id || r.patientId || '');
    if (!pid) return;
    const t = parseTs(r.submitted_at || r.created_at);
    const prev = reportByPatient.get(pid);
    if (!prev || (t && t > prev)) reportByPatient.set(pid, t || 0);
  });

  const atRiskResidents = inCare
    .map((p) => {
      const id = p.id;
      const name = p.full_name || p.name || p.patient_name || 'Resident';
      const status = String(p.clinical_status || p.status || '').toLowerCase();
      const adm = parseTs(p.admitted_at || p.admissionDate);
      const stayDays = adm ? Math.ceil((Date.now() - adm) / DAY_MS) : 0;
      const lastReport = reportByPatient.get(String(id));
      const daysSinceReport = lastReport
        ? Math.floor((Date.now() - lastReport) / DAY_MS)
        : 999;

      const reasons = [];
      let score = 0;
      if (status.includes('declin')) {
        reasons.push('Clinical status declining');
        score += 3;
      }
      if (stayDays > avgStay * 1.4) {
        reasons.push(`Stay ${stayDays}d (above typical ${avgStay}d)`);
        score += 2;
      }
      if (daysSinceReport > 14) {
        reasons.push('No weekly report in 14+ days');
        score += 2;
      }
      if (stayDays > 90) {
        reasons.push('Extended stay (90+ days)');
        score += 1;
      }

      return {
        id,
        name,
        reasons,
        score,
        stayDays,
        room: p.room || p.room_number || null,
        clinicalStatus: p.clinical_status || p.status || '',
        daysSinceReport: daysSinceReport < 999 ? daysSinceReport : null,
      };
    })
    .filter((r) => r.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const forecastSparkline = [
    ...recent.slice(-14).map((p) => p.value),
    projected14,
  ];

  const confidence = buildConfidenceMeta({
    occupancyDays: occupancySeries.length,
    admissionWeeksActive: activeWeeks.length,
    weeklyReportCount: (weeklyReports || []).length,
    patientsInCare: inCare.length,
    admissionRequestCount: (admissionRequests || []).length,
  });

  const inCareProgramMix = {};
  inCare.forEach((p) => {
    const key = mapProgramKey(p.primary_concern || p.concern || p.reason || '');
    inCareProgramMix[key] = (inCareProgramMix[key] || 0) + 1;
  });

  const dailyDischarge = buildDailyDischargeForecast(patients, pendingDischarges, avgStay);

  return {
    bedCapacity: cap,
    currentOccupancy,
    currentOccupancyPct: currentPct,
    occupancy: {
      trend: trendLabel,
      slopePerDay: Number(trendSlope.toFixed(2)),
      projected14d: Math.min(cap, projected14),
      projected30d: Math.min(cap, projected30),
      series: occupancySeries,
      sparkline: forecastSparkline,
    },
    admissions: {
      avgPerWeek: avgWeeklyAdmissions,
      projected30d: projectedAdmissions30,
      weeklyHistory: weeklyAdm,
    },
    discharges: {
      pending: pendingDischargeCount,
      pendingAdmissions: (pendingAdmissions || []).length,
      estDaysToClearPending,
      avgStayDays: avgStay,
      daily: dailyDischarge,
    },
    dailyDischarge,
    capacity: {
      risk: capacityRisk,
      daysTo90Pct: daysTo90,
      daysToFull,
      message:
        capacityRisk === 'critical'
          ? 'Capacity may be reached within two weeks at the current trend.'
          : capacityRisk === 'high'
            ? 'Plan bed assignments — occupancy is trending high.'
            : capacityRisk === 'medium'
              ? 'Monitor weekly admissions against available beds.'
              : 'Occupancy trend is within a comfortable range.',
    },
    atRiskResidents,
    confidence,
    inCareProgramMix,
    dataHealth: {
      occupancyDays: occupancySeries.length,
      admissionWeeksActive: activeWeeks.length,
      weeklyReportCount: (weeklyReports || []).length,
      patientsInCare: inCare.length,
    },
  };
}

function mapProgramKey(concern) {
  const c = String(concern || '').toLowerCase();
  if (c.includes('alcohol')) return 'Alcohol';
  if (c.includes('gambling')) return 'Gambling';
  if (c.includes('drug') || c.includes('substance')) return 'Drugs';
  if (c.includes('mental')) return 'Mental health';
  return 'Other';
}
