import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    TrendingUp,
    AlertTriangle,
    Star,
    Clock,
    FileText,
    Download,
    Printer,
    Users,
    PieChart,
    Activity,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { APP_DATA_REFRESH } from '@/lib/appDataRefresh';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const PERIOD_OPTIONS = [
    { value: 'weekly', label: 'Weekly', days: 7 },
    { value: 'monthly', label: 'Monthly', days: 30 },
    { value: 'quarterly', label: 'Quarterly', days: 90 },
    { value: 'yearly', label: 'Yearly', days: 365 },
];

const PROGRAM_FILTER_OPTIONS = [
    { value: 'all', label: 'All Programs' },
    { value: 'drugs', label: 'Drugs' },
    { value: 'alcohol', label: 'Alcohol' },
    { value: 'gambling', label: 'Gambling' },
    { value: 'mental_health', label: 'Mental health' },
];

const GENDER_OPTIONS = [
    { value: 'all', label: 'All Gender' },
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' },
    { value: 'Other', label: 'Other' },
];

const AGE_OPTIONS = [
    { value: 'all', label: 'All Ages' },
    { value: '0-17', label: '0–17' },
    { value: '18-35', label: '18–35' },
    { value: '36-55', label: '36–55' },
    { value: '56+', label: '56+' },
];

const OUTCOME_OPTIONS = [
    { value: 'all', label: 'All Outcomes' },
    { value: 'Admitted', label: 'Admitted' },
    { value: 'Improving', label: 'Improving' },
    { value: 'Stable', label: 'Stable' },
    { value: 'Declining', label: 'Declining' },
    { value: 'Discharged', label: 'Discharged' },
];

const BED_CAPACITY = 50;

function parseTs(iso) {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    return Number.isNaN(t) ? null : t;
}

/** Maps free-text concern / admission reason to a single program bucket (aligned with patient-database concern categories). */
function mapProgramKey(concern) {
    const c = String(concern || '').toLowerCase();
    if (c.includes('non-substance') || c.includes('non substance')) return 'mental_health';
    if (c.includes('alcohol')) return 'alcohol';
    if (c.includes('gambling') || c.includes('betting')) return 'gambling';
    if (c.includes('drug') || c.includes('substance')) return 'drugs';
    if (
        c.includes('mental health') ||
        c.includes('psychiatr') ||
        c.includes('psycholog') ||
        c.includes('depression') ||
        c.includes('anxiety') ||
        c.includes('psych')
    ) {
        return 'mental_health';
    }
    if (c.includes('physical') || c.includes('physio') || (c.includes('therapy') && !c.includes('mental'))) return 'mental_health';
    return 'other';
}

function programMatchesFilter(rawKey, filterVal) {
    if (filterVal === 'all') return true;
    if (rawKey === 'other') {
        if (filterVal === 'mental_health') return true;
        return false;
    }
    return rawKey === filterVal;
}

function ageBucket(age) {
    if (age == null || age === '' || Number.isNaN(Number(age))) return null;
    const n = Number(age);
    if (n <= 17) return '0-17';
    if (n <= 35) return '18-35';
    if (n <= 55) return '36-55';
    return '56+';
}

function normalizeRawPatient(p, idx) {
    const concern = p.concern || p.reason || p.primary_concern || '';
    const name = p.name || p.patient_name || p.full_name || `Patient ${idx + 1}`;
    const gender = String(p.gender || '').trim() || 'N/A';
    let age = p.age;
    if (typeof age === 'string' && age !== 'N/A') age = parseInt(age, 10);
    if (!Number.isFinite(age)) age = null;
    const admitted_at = p.admitted_at || p.admissionDate || p.createdAt || null;
    const discharged_at = p.discharged_at || null;
    const status = String(p.status || p.clinicalStatus || 'Admitted');
    const therapist = String(p.therapist || p.assignedStaff || '').trim() || 'Unassigned';
    const programKeyRaw = mapProgramKey(concern);
    return {
        id: p.id ?? `p-${idx}`,
        name,
        concern,
        gender,
        age,
        admitted_at,
        discharged_at,
        status,
        therapist,
        programKeyRaw,
    };
}

function requestTimeMs(req) {
    return (
        parseTs(req.created_at || req.declinedAt || req.createdAt) ||
        (req.requestTime ? parseTs(req.requestTime) : null)
    );
}

function ageFromDob(dob) {
    if (!dob) return null;
    const d = new Date(dob);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
    return age >= 0 ? age : null;
}

function mapPatientFromDbRow(row) {
    return {
        id: row.id,
        name: row.full_name,
        full_name: row.full_name,
        concern: row.primary_concern,
        primary_concern: row.primary_concern,
        gender: row.gender || 'N/A',
        age: ageFromDob(row.date_of_birth),
        admitted_at: row.admitted_at,
        discharged_at: row.discharged_at,
        status: row.discharged_at ? 'Discharged' : (row.clinical_status || 'Admitted'),
        clinicalStatus: row.clinical_status,
        therapist: String(row.assigned_staff || row.therapist || '').trim() || 'Unassigned',
    };
}

function mapPendingAdmissionFromDb(r) {
    return {
        id: r.id,
        name: r.patient_name,
        reason: r.reason_for_admission,
        created_at: r.created_at,
        requestTime: r.created_at,
        patient_gender: r.patient_gender,
        patient_birth_date: r.patient_birth_date,
        assignedStaff: String(r.assigned_staff || r.assignedStaff || '').trim() || 'Unassigned',
    };
}

function mapDeclinedFromDb(rows, type) {
    return (rows || []).map((r) => ({
        id: r.id,
        name: r.patient_name || (type === 'discharge' ? 'Discharge request' : 'Admission request'),
        reason: type === 'admission' ? r.reason_for_admission : (r.reason_category || r.reason_details || ''),
        created_at: r.created_at,
        declinedAt: r.decided_at || r.updated_at || r.created_at,
        patient_gender: r.patient_gender,
        assignedStaff: String(r.assigned_staff || r.assignedStaff || '').trim() || 'Unassigned',
        type,
    }));
}

async function fetchAnalyticsFromSupabase() {
    const { data: patientRows, error: pErr } = await supabase
        .from('patients')
        .select('*')
        .order('admitted_at', { ascending: false })
        .limit(8000);
    if (pErr) throw pErr;

    const { data: pendingRows, error: aErr } = await supabase
        .from('admission_requests')
        .select('*')
        .eq('status', 'pending');
    if (aErr) throw aErr;
    const { data: allAdmissionRows, error: allAdmErr } = await supabase
        .from('admission_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10000);
    if (allAdmErr) throw allAdmErr;

    const { data: pendingDisRows, error: dPendErr } = await supabase
        .from('discharge_requests')
        .select('*')
        .eq('status', 'pending');
    if (dPendErr) throw dPendErr;

    const { data: decAdm, error: decAdmErr } = await supabase.from('admission_requests').select('*').eq('status', 'declined');
    if (decAdmErr) console.warn('[analytics] declined admissions', decAdmErr);

    const { data: decDis, error: decDisErr } = await supabase.from('discharge_requests').select('*').eq('status', 'declined');
    if (decDisErr) console.warn('[analytics] declined discharges', decDisErr);

    const { data: weeklyRows, error: wrErr } = await supabase
        .from('weekly_reports')
        .select('*')
        .order('submitted_at', { ascending: false })
        .limit(5000);
    if (wrErr) console.warn('[analytics] weekly reports', wrErr);

    const patients = (patientRows || []).map(mapPatientFromDbRow);
    const pendingAdmissions = (pendingRows || []).map(mapPendingAdmissionFromDb);
    const admissionRequests = allAdmissionRows || [];
    const pendingDischarges = pendingDisRows || [];
    const weeklyReports = weeklyRows || [];
    const declined = [
        ...mapDeclinedFromDb(decAdmErr ? [] : decAdm, 'admission'),
        ...mapDeclinedFromDb(decDisErr ? [] : decDis, 'discharge'),
    ];

    return { patients, pendingAdmissions, admissionRequests, pendingDischarges, weeklyReports, declined };
}

export default function AdminAnalyticsSection() {
    const navigate = useNavigate();
    const [snapshot, setSnapshot] = useState({
        patients: [],
        pendingAdmissions: [],
        admissionRequests: [],
        pendingDischarges: [],
        weeklyReports: [],
        declined: [],
    });
    const [remoteLoading, setRemoteLoading] = useState(false);
    const [loadError, setLoadError] = useState(null);

    /** Admission decisions from DB: approved vs declined in the selected reporting period (decided_at). */
    const [admissionDecisionCounts, setAdmissionDecisionCounts] = useState({ approved: 0, declined: 0 });

    const [filterPeriod, setFilterPeriod] = useState('monthly');
    const [filterProgram, setFilterProgram] = useState('all');
    const [filterGender, setFilterGender] = useState('all');
    const [filterAge, setFilterAge] = useState('all');
    const [filterTherapist, setFilterTherapist] = useState('all');
    const [filterOutcome, setFilterOutcome] = useState('all');
    const [selectedProgramKey, setSelectedProgramKey] = useState('drugs');

    const loadLocalSnapshot = useCallback(() => ({
        patients: JSON.parse(localStorage.getItem('bh_patients') || '[]'),
        pendingAdmissions: JSON.parse(localStorage.getItem('bh_pending_admissions') || '[]'),
        admissionRequests: (() => {
            const pending = JSON.parse(localStorage.getItem('bh_pending_admissions') || '[]').map((r) => ({
                ...r,
                status: 'pending',
                created_at: r.created_at || r.requestTime || r.createdAt || null,
            }));
            const declined = JSON.parse(localStorage.getItem('bh_declined_requests') || '[]')
                .filter((r) => r.type === 'admission')
                .map((r) => ({
                    ...r,
                    status: 'declined',
                    created_at: r.created_at || r.requestTime || r.createdAt || null,
                    reason_for_admission: r.reason || '',
                }));
            const approved = JSON.parse(localStorage.getItem('bh_patients') || '[]').map((p) => ({
                id: `approved-${p.id}`,
                status: 'approved',
                created_at: p.admitted_at || p.admissionDate || p.createdAt || null,
                reason_for_admission: p.concern || p.reason || p.primary_concern || '',
                patient_gender: p.gender || null,
                patient_birth_date: p.dateOfBirth || null,
                assigned_staff: p.assigned_staff || p.therapist || p.assignedStaff || null,
            }));
            return [...pending, ...declined, ...approved];
        })(),
        pendingDischarges: JSON.parse(localStorage.getItem('bh_pending_discharges') || '[]'),
        weeklyReports: JSON.parse(localStorage.getItem('bh_nurse_weekly_reports') || '[]'),
        declined: JSON.parse(localStorage.getItem('bh_declined_requests') || '[]'),
    }), []);

    const reloadSnapshot = useCallback(async () => {
        if (isSupabaseConfigured()) {
            setRemoteLoading(true);
            setLoadError(null);
            try {
                const snap = await fetchAnalyticsFromSupabase();
                setSnapshot(snap);
            } catch (e) {
                console.warn('[analytics]', e);
                setLoadError(e?.message || 'Could not load from the database');
                setSnapshot(loadLocalSnapshot());
            } finally {
                setRemoteLoading(false);
            }
        } else {
            setLoadError(null);
            setSnapshot(loadLocalSnapshot());
        }
    }, [loadLocalSnapshot]);

    useEffect(() => {
        void reloadSnapshot();
        const onRefresh = () => {
            void reloadSnapshot();
        };
        window.addEventListener('storage', onRefresh);
        window.addEventListener(APP_DATA_REFRESH, onRefresh);
        return () => {
            window.removeEventListener('storage', onRefresh);
            window.removeEventListener(APP_DATA_REFRESH, onRefresh);
        };
    }, [reloadSnapshot]);

    useEffect(() => {
        if (!isSupabaseConfigured()) {
            setAdmissionDecisionCounts({ approved: 0, declined: 0 });
            return;
        }
        let cancelled = false;
        const days = PERIOD_OPTIONS.find((o) => o.value === filterPeriod)?.days ?? 30;
        const sinceIso = new Date(Date.now() - days * 86400000).toISOString();

        (async () => {
            try {
                const [apRes, decRes] = await Promise.all([
                    supabase
                        .from('admission_requests')
                        .select('*', { count: 'exact', head: true })
                        .eq('status', 'approved')
                        .gte('decided_at', sinceIso),
                    supabase
                        .from('admission_requests')
                        .select('*', { count: 'exact', head: true })
                        .eq('status', 'declined')
                        .gte('decided_at', sinceIso),
                ]);
                if (cancelled) return;
                if (apRes.error) console.warn('[analytics] admission approved count', apRes.error);
                if (decRes.error) console.warn('[analytics] admission declined count', decRes.error);
                setAdmissionDecisionCounts({
                    approved: apRes.error ? 0 : (apRes.count ?? 0),
                    declined: decRes.error ? 0 : (decRes.count ?? 0),
                });
            } catch (e) {
                console.warn('[analytics] admission decision counts', e);
                if (!cancelled) setAdmissionDecisionCounts({ approved: 0, declined: 0 });
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [filterPeriod, remoteLoading]);

    const periodDays = PERIOD_OPTIONS.find((o) => o.value === filterPeriod)?.days ?? 30;
    const periodStartMs = Date.now() - periodDays * 86400000;

    const normalizedPatients = useMemo(
        () => snapshot.patients.map((p, i) => normalizeRawPatient(p, i)),
        [snapshot.patients]
    );

    const therapistOptions = useMemo(() => {
        const set = new Set();
        normalizedPatients.forEach((p) => set.add(p.therapist || 'Unassigned'));
        return ['all', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
    }, [normalizedPatients]);

    const filteredPatients = useMemo(() => {
        return normalizedPatients.filter((p) => {
            const t = parseTs(p.admitted_at);
            if (t != null && t < periodStartMs) return false;

            if (!programMatchesFilter(p.programKeyRaw, filterProgram)) return false;

            if (filterGender !== 'all' && String(p.gender).toLowerCase() !== String(filterGender).toLowerCase()) {
                return false;
            }
            if (filterAge !== 'all') {
                const b = ageBucket(p.age);
                if (!b || b !== filterAge) return false;
            }
            if (filterTherapist !== 'all' && (p.therapist || 'Unassigned') !== filterTherapist) {
                return false;
            }
            if (filterOutcome !== 'all' && String(p.status).toLowerCase() !== String(filterOutcome).toLowerCase()) {
                return false;
            }
            return true;
        });
    }, [
        normalizedPatients,
        periodStartMs,
        filterProgram,
        filterGender,
        filterAge,
        filterTherapist,
        filterOutcome,
    ]);

    const filteredPending = useMemo(() => {
        return snapshot.pendingAdmissions.filter((req) => {
            const rt = requestTimeMs(req);
            if (rt != null && rt < periodStartMs) return false;
            const reason = req.reason || '';
            if (!programMatchesFilter(mapProgramKey(reason), filterProgram)) return false;
            if (filterGender !== 'all') {
                const g = req.patient_gender || req.gender;
                if (g && String(g).toLowerCase() !== String(filterGender).toLowerCase()) return false;
            }
            if (filterAge !== 'all' && req.patient_birth_date) {
                const dob = new Date(req.patient_birth_date);
                if (!Number.isNaN(dob.getTime())) {
                    let age = new Date().getFullYear() - dob.getFullYear();
                    const m = new Date().getMonth() - dob.getMonth();
                    if (m < 0 || (m === 0 && new Date().getDate() < dob.getDate())) age--;
                    const b = ageBucket(age);
                    if (!b || b !== filterAge) return false;
                }
            }
            if (filterTherapist !== 'all') {
                const st = String(req.assignedStaff || req.therapist || '').trim() || 'Unassigned';
                if (st !== filterTherapist) return false;
            }
            return true;
        });
    }, [snapshot.pendingAdmissions, periodStartMs, filterProgram, filterGender, filterAge, filterTherapist]);

    const filteredDeclined = useMemo(() => {
        return snapshot.declined.filter((req) => {
            const rt = requestTimeMs(req);
            if (rt != null && rt < periodStartMs) return false;
            const reason = req.reason || '';
            if (!programMatchesFilter(mapProgramKey(reason), filterProgram)) return false;
            if (filterGender !== 'all') {
                const g = req.patient_gender || req.gender;
                if (g && String(g).toLowerCase() !== String(filterGender).toLowerCase()) return false;
            }
            if (filterTherapist !== 'all') {
                const st = String(req.assignedStaff || req.therapist || '').trim() || 'Unassigned';
                if (st !== filterTherapist) return false;
            }
            return true;
        });
    }, [snapshot.declined, periodStartMs, filterProgram, filterGender, filterTherapist]);

    const filteredPendingDischarges = useMemo(() => {
        return snapshot.pendingDischarges.filter((req) => {
            const rt = requestTimeMs(req);
            const reason = req.reason_category || req.reason_details || req.reason || '';
            if (!programMatchesFilter(mapProgramKey(reason), filterProgram)) return false;
            if (filterGender !== 'all') {
                const g = req.patient_gender || req.gender;
                if (g && String(g).toLowerCase() !== String(filterGender).toLowerCase()) return false;
            }
            if (filterTherapist !== 'all') {
                const st = String(req.assigned_staff || req.assignedStaff || req.therapist || '').trim() || 'Unassigned';
                if (st !== filterTherapist) return false;
            }
            return true;
        });
    }, [snapshot.pendingDischarges, filterProgram, filterGender, filterTherapist]);

    const filteredAdmissionRequests = useMemo(() => {
        return (snapshot.admissionRequests || []).filter((req) => {
            const rt = requestTimeMs(req);
            if (rt != null && rt < periodStartMs) return false;
            const reason = req.reason_for_admission || req.reason || '';
            if (!programMatchesFilter(mapProgramKey(reason), filterProgram)) return false;
            if (filterGender !== 'all') {
                const g = req.patient_gender || req.gender;
                if (g && String(g).toLowerCase() !== String(filterGender).toLowerCase()) return false;
            }
            if (filterAge !== 'all' && req.patient_birth_date) {
                const dob = new Date(req.patient_birth_date);
                if (!Number.isNaN(dob.getTime())) {
                    let age = new Date().getFullYear() - dob.getFullYear();
                    const m = new Date().getMonth() - dob.getMonth();
                    if (m < 0 || (m === 0 && new Date().getDate() < dob.getDate())) age--;
                    const b = ageBucket(age);
                    if (!b || b !== filterAge) return false;
                }
            }
            if (filterTherapist !== 'all') {
                const st = String(req.assigned_staff || req.assignedStaff || req.therapist || '').trim() || 'Unassigned';
                if (st !== filterTherapist) return false;
            }
            return true;
        });
    }, [snapshot.admissionRequests, periodStartMs, filterProgram, filterGender, filterAge, filterTherapist]);

    const trendCohort = useMemo(
        () =>
            normalizedPatients.filter((p) => {
                if (!programMatchesFilter(p.programKeyRaw, filterProgram)) return false;
                if (filterGender !== 'all' && String(p.gender).toLowerCase() !== String(filterGender).toLowerCase()) {
                    return false;
                }
                if (filterAge !== 'all') {
                    const b = ageBucket(p.age);
                    if (!b || b !== filterAge) return false;
                }
                if (filterTherapist !== 'all' && (p.therapist || 'Unassigned') !== filterTherapist) {
                    return false;
                }
                if (filterOutcome !== 'all' && String(p.status).toLowerCase() !== String(filterOutcome).toLowerCase()) {
                    return false;
                }
                return true;
            }),
        [normalizedPatients, filterProgram, filterGender, filterAge, filterTherapist, filterOutcome]
    );

    const metrics = useMemo(() => {
        const approved = filteredPatients.length;
        const pending = filteredPending.length;
        const declined = filteredDeclined.length;
        const total = approved + pending + declined;
        return { total: total > 0 ? total : 0, approved, pending, declined };
    }, [filteredPatients, filteredPending, filteredDeclined]);

    const admissionFunnel = useMemo(() => {
        const approved = filteredAdmissionRequests.filter((r) => String(r.status).toLowerCase() === 'approved').length;
        const pending = filteredAdmissionRequests.filter((r) => String(r.status).toLowerCase() === 'pending').length;
        const declined = filteredAdmissionRequests.filter((r) => String(r.status).toLowerCase() === 'declined').length;
        const submitted = approved + pending + declined;
        return { submitted, approved, pending, declined };
    }, [filteredAdmissionRequests]);

    const dischargeQueueAging = useMemo(() => {
        const now = Date.now();
        const buckets = { '0-2d': 0, '3-7d': 0, '8+d': 0 };
        filteredPendingDischarges.forEach((req) => {
            const created = requestTimeMs(req);
            if (!created) return;
            const ageDays = Math.floor((now - created) / 86400000);
            if (ageDays <= 2) buckets['0-2d'] += 1;
            else if (ageDays <= 7) buckets['3-7d'] += 1;
            else buckets['8+d'] += 1;
        });
        return buckets;
    }, [filteredPendingDischarges]);

    const occupancyKpi = useMemo(() => {
        const bedCapacity = BED_CAPACITY;
        const activePatients = normalizedPatients.filter((p) => !p.discharged_at).filter((p) => {
            if (!programMatchesFilter(p.programKeyRaw, filterProgram)) return false;
            if (filterGender !== 'all' && String(p.gender).toLowerCase() !== String(filterGender).toLowerCase()) {
                return false;
            }
            if (filterAge !== 'all') {
                const b = ageBucket(p.age);
                if (!b || b !== filterAge) return false;
            }
            if (filterTherapist !== 'all' && (p.therapist || 'Unassigned') !== filterTherapist) {
                return false;
            }
            return true;
        });
        const activeCount = activePatients.length;
        const occupancyPercent = bedCapacity > 0 ? Math.round((activeCount / bedCapacity) * 100) : 0;
        const availableBeds = Math.max(0, bedCapacity - activeCount);
        return { bedCapacity, activeCount, occupancyPercent, availableBeds };
    }, [normalizedPatients, filterProgram, filterGender, filterAge, filterTherapist]);

    /** #7 Occupancy forecast: pipeline scenarios from pending admits/discharges (planning horizon ≈ next week). */
    const occupancyForecast = useMemo(() => {
        const cap = BED_CAPACITY;
        const current = occupancyKpi.activeCount;
        const padm = filteredPending.length;
        const pdis = filteredPendingDischarges.length;
        const clamp = (n) => Math.max(0, Math.min(cap, n));
        const ifAllAdmits = clamp(current + padm);
        const ifAllDischarges = clamp(current - pdis);
        const netIfAll = clamp(current + padm - pdis);
        const pct = (n) => (cap > 0 ? Math.round((n / cap) * 100) : 0);
        return {
            pendingAdmissions: padm,
            pendingDischarges: pdis,
            ifAllAdmits,
            ifAllDischarges,
            netIfAll,
            pctAdmits: pct(ifAllAdmits),
            pctDischarges: pct(ifAllDischarges),
            pctNet: pct(netIfAll),
        };
    }, [occupancyKpi.activeCount, filteredPending.length, filteredPendingDischarges.length]);

    const staffWorkload = useMemo(() => {
        const activePatients = filteredPatients.filter((p) => !p.discharged_at);
        const counts = new Map();
        activePatients.forEach((p) => {
            const staffName = String(p.therapist || p.assigned_staff || 'Unassigned').trim() || 'Unassigned';
            counts.set(staffName, (counts.get(staffName) || 0) + 1);
        });
        const rows = Array.from(counts.entries())
            .map(([name, count]) => ({
                name,
                displayName: name === 'Unassigned' ? 'No staff assigned yet' : name,
                count,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6);
        const max = rows.length ? Math.max(...rows.map((r) => r.count)) : 1;
        const unassignedCount = counts.get('Unassigned') || 0;
        const total = activePatients.length;
        const unassignedPercent = total > 0 ? Math.round((unassignedCount / total) * 100) : 0;
        const unassignedPatients = activePatients
            .filter((p) => (String(p.therapist || '').trim() || 'Unassigned') === 'Unassigned')
            .slice(0, 8)
            .map((p) => p.name);
        return { rows, max, unassignedCount, total, unassignedPercent, unassignedPatients };
    }, [filteredPatients]);

    const declineReasonBreakdown = useMemo(() => {
        const reasonMap = new Map();
        filteredDeclined.forEach((r) => {
            const raw = String(r.reason || '').trim();
            const normalized = raw
                ? raw.toLowerCase().includes('alcohol')
                    ? 'Alcohol concern'
                    : raw.toLowerCase().includes('drug')
                        ? 'Drug concern'
                        : raw.toLowerCase().includes('gambl')
                            ? 'Gambling concern'
                            : raw.length > 40
                                ? `${raw.slice(0, 40)}...`
                                : raw
                : 'Unspecified';
            reasonMap.set(normalized, (reasonMap.get(normalized) || 0) + 1);
        });
        const rows = Array.from(reasonMap.entries())
            .map(([reason, count]) => ({ reason, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6);
        const total = rows.reduce((sum, r) => sum + r.count, 0);
        return { rows, total };
    }, [filteredDeclined]);

    const appPerc = metrics.total > 0 ? Math.round((metrics.approved / metrics.total) * 100) : 0;
    const penPerc = metrics.total > 0 ? Math.round((metrics.pending / metrics.total) * 100) : 0;
    const decPerc = metrics.total > 0 ? Math.max(0, 100 - appPerc - penPerc) : 0;

    /** Success rate = approved admission decisions ÷ (approved + declined) in period, from admission_requests. */
    const successRateInfo = useMemo(() => {
        if (isSupabaseConfigured()) {
            const { approved, declined } = admissionDecisionCounts;
            const decided = approved + declined;
            if (decided === 0) {
                return {
                    percent: null,
                    pdfText: '— (no approved/declined admissions in period)',
                };
            }
            const pct = Math.round((approved / decided) * 100);
            return {
                percent: pct,
                pdfText: `${pct}% (${approved} approved / ${declined} declined)`,
            };
        }
        const t = metrics.total;
        if (t === 0) {
            return {
                percent: null,
                pdfText: '—',
            };
        }
        const pct = Math.round((metrics.approved / t) * 100);
        return {
            percent: pct,
            pdfText: `${pct}% (estimated from local snapshot)`,
        };
    }, [admissionDecisionCounts, metrics.approved, metrics.total]);

    const avgStayDays = useMemo(() => {
        let sum = 0;
        let n = 0;
        filteredPatients.forEach((p) => {
            const adm = parseTs(p.admitted_at);
            const dis = parseTs(p.discharged_at);
            if (adm && dis && dis > adm) {
                sum += (dis - adm) / (86400000);
                n += 1;
            }
        });
        if (n === 0) return 28;
        return Math.max(1, Math.round(sum / n));
    }, [filteredPatients]);

    const barCounts = useMemo(() => {
        const c = { drugs: 0, alcohol: 0, gambling: 0, mental_health: 0 };
        filteredPatients.forEach((p) => {
            const pk = p.programKeyRaw === 'other' ? 'mental_health' : p.programKeyRaw;
            if (c[pk] !== undefined) c[pk] += 1;
            else c.mental_health += 1;
        });
        return c;
    }, [filteredPatients]);

    const rawBarMax = Math.max(1, barCounts.drugs, barCounts.alcohol, barCounts.gambling, barCounts.mental_health);
    const barTickStep = Math.max(1, Math.ceil(rawBarMax / 5));
    const barAxisMax = Math.max(5, Math.ceil(rawBarMax / barTickStep) * barTickStep);
    const barScale = (v) => (v / barAxisMax) * 120;

    const barTickVals = useMemo(() => {
        const ticks = [];
        for (let v = 0; v <= barAxisMax; v += barTickStep) ticks.push(v);
        return ticks;
    }, [barAxisMax, barTickStep]);

    const selectedProgramPatients = useMemo(() => {
        return filteredPatients.filter((p) => {
            const key = p.programKeyRaw === 'other' ? 'mental_health' : p.programKeyRaw;
            return key === selectedProgramKey;
        });
    }, [filteredPatients, selectedProgramKey]);

    const lineSeries = useMemo(() => {
        const days = 56;
        const start = Date.now() - days * 86400000;
        const buckets = Array(8).fill(0);
        trendCohort.forEach((p) => {
            const t = parseTs(p.admitted_at);
            if (!t || t < start) return;
            const idx = Math.min(7, Math.floor(((t - start) / (days * 86400000)) * 8));
            buckets[idx] += 1;
        });
        const maxV = Math.max(7, ...buckets, 1);
        const maxY = Math.ceil(maxV * 1.1);
        return { buckets, maxY };
    }, [trendCohort]);

    const insights = useMemo(() => {
        const now = Date.now();
        const d30 = 30 * 86400000;
        const d90 = 90 * 86400000;
        const winCur = { start: now - d30, end: now };
        const winPrev = { start: now - 2 * d30, end: now - d30 };

        const inWin = (iso, w) => {
            const t = parseTs(iso);
            return t && t >= w.start && t < w.end;
        };

        const countReqMix = (w) => {
            const a = normalizedPatients.filter((p) => inWin(p.admitted_at, w)).length;
            const pe = snapshot.pendingAdmissions.filter((r) => inWin(r.created_at, w)).length;
            const de = snapshot.declined.filter((r) => inWin(r.declinedAt || r.created_at, w)).length;
            const tot = a + pe + de;
            return { a, pe, de, tot, sr: tot > 0 ? Math.round((a / tot) * 100) : 0 };
        };

        const curM = countReqMix(winCur);
        const prevM = countReqMix(winPrev);
        const successDelta = curM.sr - prevM.sr;

        const dowCounts = [0, 0, 0, 0, 0, 0, 0];
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        normalizedPatients.forEach((p) => {
            const t = parseTs(p.admitted_at);
            if (!t || t < now - d90) return;
            dowCounts[new Date(t).getDay()] += 1;
        });
        const maxD = Math.max(...dowCounts, 0);
        const peakD = maxD > 0 ? dowCounts.indexOf(maxD) : 1;
        const peakDayName = dayNames[peakD] || 'Monday';

        const progKeys = [
            { key: 'drugs', label: 'Drugs' },
            { key: 'alcohol', label: 'Alcohol' },
            { key: 'gambling', label: 'Gambling' },
            { key: 'mental_health', label: 'Mental health' },
        ];
        let bestProgLabel = progKeys[0].label;
        let bestRate = -1;
        progKeys.forEach(({ key, label }) => {
            const cohort = normalizedPatients.filter((p) => {
                const raw = p.programKeyRaw;
                if (key === 'mental_health') return raw === 'mental_health' || raw === 'other';
                return raw === key;
            });
            const done = cohort.filter((p) => p.discharged_at || String(p.status).toLowerCase() === 'discharged').length;
            const rate = cohort.length ? done / cohort.length : 0;
            if (cohort.length > 0 && rate >= bestRate) {
                bestRate = rate;
                bestProgLabel = label;
            }
        });

        let sumStay = 0;
        let nStay = 0;
        normalizedPatients.forEach((p) => {
            const adm = parseTs(p.admitted_at);
            const dis = parseTs(p.discharged_at);
            if (adm && dis && dis > adm && inWin(adm, winCur)) {
                sumStay += (dis - adm) / 86400000;
                nStay += 1;
            }
        });
        let sumStayPrev = 0;
        let nStayPrev = 0;
        normalizedPatients.forEach((p) => {
            const adm = parseTs(p.admitted_at);
            const dis = parseTs(p.discharged_at);
            if (adm && dis && dis > adm && inWin(adm, winPrev)) {
                sumStayPrev += (dis - adm) / 86400000;
                nStayPrev += 1;
            }
        });
        const avgCur = nStay ? sumStay / nStay : null;
        const avgPrev = nStayPrev ? sumStayPrev / nStayPrev : null;
        const stayDelta =
            avgCur != null && avgPrev != null ? Math.round(avgCur - avgPrev) : null;

        const successText =
            curM.tot === 0 && prevM.tot === 0
                ? 'Connect patient records to see approval trends vs the prior 30 days.'
                : prevM.tot === 0
                  ? `Approval share of requests is ${curM.sr}% in the last 30 days.`
                  : `Success rate ${successDelta >= 0 ? 'increased' : 'decreased'} by ${Math.abs(successDelta)}% vs the prior 30 days.`;

        const noShowText = `Highest admission volume in the last 90 days falls on ${peakDayName}s.`;

        const programText =
            normalizedPatients.length === 0
                ? 'Program completion insights appear when patient data is available.'
                : Math.round(bestRate * 100) === 0
                  ? 'Discharge completion by program will appear as patients finish care.'
                  : `${bestProgLabel} leads discharge completion (${Math.round(bestRate * 100)}% of cohort discharged).`;

        const stayText =
            stayDelta == null
                ? 'Average stay change compares completed stays in the last 30 days vs the prior 30 days.'
                : `Average stay ${stayDelta >= 0 ? 'increased' : 'decreased'} by ${Math.abs(stayDelta)} day(s) vs the prior 30 days.`;

        return {
            successDelta,
            currentSuccessRate: curM.sr,
            peakDayName,
            peakDayCount: maxD,
            bestProgLabel,
            bestProgRate: Math.round(bestRate * 100),
            stayDelta,
            successText,
            noShowText,
            programText,
            stayText,
        };
    }, [normalizedPatients, snapshot.pendingAdmissions, snapshot.declined]);

    const linePoints = useMemo(() => {
        const { buckets, maxY } = lineSeries;
        const yBase = 160;
        const h = 120;
        const x0 = 50;
        const x1 = 946;
        const n = buckets.length;
        const step = n > 1 ? (x1 - x0) / (n - 1) : 0;
        return buckets.map((v, i) => ({
            x: x0 + i * step,
            y: yBase - (maxY > 0 ? (v / maxY) * h : 0),
            v,
        }));
    }, [lineSeries]);

    const linePathD = useMemo(() => {
        if (linePoints.length === 0) return '';
        const yBase = 160;
        let d = `M ${linePoints[0].x} ${linePoints[0].y}`;
        for (let i = 1; i < linePoints.length; i += 1) {
            d += ` L ${linePoints[i].x} ${linePoints[i].y}`;
        }
        const last = linePoints[linePoints.length - 1];
        const first = linePoints[0];
        d += ` L ${last.x} ${yBase} L ${first.x} ${yBase} Z`;
        return d;
    }, [linePoints]);

    const lineStrokeD = useMemo(() => {
        if (linePoints.length === 0) return '';
        let d = `M ${linePoints[0].x} ${linePoints[0].y}`;
        for (let i = 1; i < linePoints.length; i += 1) {
            d += ` L ${linePoints[i].x} ${linePoints[i].y}`;
        }
        return d;
    }, [linePoints]);

    const yTicks = useMemo(() => {
        const m = lineSeries.maxY;
        const step = Math.max(1, Math.ceil(m / 4));
        const arr = [];
        for (let v = 0; v <= m; v += step) arr.push(v);
        if (arr[arr.length - 1] !== m) arr.push(m);
        return arr;
    }, [lineSeries.maxY]);

    const exportCsv = useCallback(() => {
        const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
        const rows = [
            ['Bridges of Hope — Analytics export', new Date().toLocaleString()],
            ['Period', PERIOD_OPTIONS.find((o) => o.value === filterPeriod)?.label || filterPeriod],
            ['Program', PROGRAM_FILTER_OPTIONS.find((o) => o.value === filterProgram)?.label || filterProgram],
            ['Gender', GENDER_OPTIONS.find((o) => o.value === filterGender)?.label || filterGender],
            ['Age', AGE_OPTIONS.find((o) => o.value === filterAge)?.label || filterAge],
            ['Therapist', filterTherapist === 'all' ? 'All' : filterTherapist],
            ['Outcome', OUTCOME_OPTIONS.find((o) => o.value === filterOutcome)?.label || filterOutcome],
            [],
            ['Name', 'Primary concern', 'Gender', 'Age', 'Status', 'Therapist', 'Admitted'],
            ...filteredPatients.map((p) => [
                p.name,
                p.concern,
                p.gender,
                p.age ?? '',
                p.status,
                p.therapist,
                p.admitted_at || '',
            ]),
            [],
            ['Pending admissions (filtered)', String(filteredPending.length)],
            ['Declined requests (filtered)', String(filteredDeclined.length)],
        ];
        const csv = rows.map((r) => r.map(esc).join(',')).join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-export-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [filterPeriod, filterProgram, filterGender, filterAge, filterTherapist, filterOutcome, filteredPatients, filteredPending, filteredDeclined]);

    const handlePrint = useCallback(() => {
        window.print();
    }, []);

    const handleExportPdf = useCallback(() => {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
        const now = new Date();
        const pageWidth = doc.internal.pageSize.getWidth();

        const filterLabel = (arr, value) => arr.find((o) => o.value === value)?.label || value;
        const periodLabel = filterLabel(PERIOD_OPTIONS, filterPeriod);
        const programLabel = filterLabel(PROGRAM_FILTER_OPTIONS, filterProgram);
        const genderLabel = filterLabel(GENDER_OPTIONS, filterGender);
        const ageLabel = filterLabel(AGE_OPTIONS, filterAge);
        const outcomeLabel = filterLabel(OUTCOME_OPTIONS, filterOutcome);
        const therapistLabel = filterTherapist === 'all' ? 'All Therapist' : filterTherapist;

        doc.setFillColor(245, 78, 37);
        doc.rect(0, 0, pageWidth, 56, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('Bridges of Hope - Analytics Report', 36, 34);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Generated: ${now.toLocaleString()}`, pageWidth - 190, 34);

        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Applied Filters', 36, 86);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Period: ${periodLabel}`, 36, 104);
        doc.text(`Program: ${programLabel}`, 210, 104);
        doc.text(`Gender: ${genderLabel}`, 360, 104);
        doc.text(`Age: ${ageLabel}`, 36, 120);
        doc.text(`Therapist: ${therapistLabel}`, 210, 120);
        doc.text(`Outcome: ${outcomeLabel}`, 360, 120);

        autoTable(doc, {
            startY: 138,
            theme: 'grid',
            head: [['Metric', 'Value']],
            body: [
                ['Total Requests', String(metrics.total)],
                ['Approved', String(metrics.approved)],
                ['Pending', String(metrics.pending)],
                ['Declined', String(metrics.declined)],
                ['Success Rate (admissions)', successRateInfo.pdfText],
                ['Average Stay', `${avgStayDays} day(s)`],
            ],
            styles: { fontSize: 10, cellPadding: 6, textColor: [30, 41, 59] },
            headStyles: { fillColor: [245, 78, 37], textColor: [255, 255, 255] },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 220 },
                1: { cellWidth: 120 },
            },
            margin: { left: 36, right: 36 },
        });

        autoTable(doc, {
            startY: doc.lastAutoTable.finalY + 18,
            theme: 'striped',
            head: [['Name', 'Primary Concern', 'Gender', 'Age', 'Status', 'Therapist', 'Admitted']],
            body: filteredPatients.map((p) => [
                p.name || '-',
                p.concern || '-',
                p.gender || '-',
                p.age ?? '-',
                p.status || '-',
                p.therapist || '-',
                p.admitted_at ? new Date(p.admitted_at).toLocaleDateString() : '-',
            ]),
            styles: { fontSize: 9, cellPadding: 5, textColor: [30, 41, 59] },
            headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 9 },
            margin: { left: 36, right: 36 },
            didDrawPage: () => {
                doc.setFontSize(8);
                doc.setTextColor(100, 116, 139);
                doc.text(
                    `Bridges of Hope Analytics - Page ${doc.getCurrentPageInfo().pageNumber}`,
                    36,
                    doc.internal.pageSize.getHeight() - 16
                );
            },
        });

        const filename = `analytics-report-${now.toISOString().slice(0, 10)}.pdf`;
        doc.save(filename);
    }, [
        filterPeriod,
        filterProgram,
        filterGender,
        filterAge,
        filterTherapist,
        filterOutcome,
        metrics.total,
        metrics.approved,
        metrics.pending,
        metrics.declined,
        successRateInfo.pdfText,
        avgStayDays,
        filteredPatients,
    ]);

    const donutPaths = useMemo(() => {
        const cx = 100;
        const cy = 100;
        const r0 = 52;
        const r1 = 78;
        const seg = [
            { f: appPerc / 100, fill: '#0d7a45' },
            { f: decPerc / 100, fill: '#ea580c' },
            { f: penPerc / 100, fill: '#2563eb' },
        ];
        const pts = (r, a) => ({
            x: cx + r * Math.cos(a),
            y: cy + r * Math.sin(a),
        });
        let a = -Math.PI / 2;
        const paths = [];
        seg.forEach(({ f, fill }) => {
            if (f <= 0) return;
            const a0 = a;
            const a1 = a + f * 2 * Math.PI;
            const os = pts(r1, a0);
            const oe = pts(r1, a1);
            const is = pts(r0, a1);
            const ie = pts(r0, a0);
            const large = a1 - a0 > Math.PI ? 1 : 0;
            const d = [
                `M ${os.x} ${os.y}`,
                `A ${r1} ${r1} 0 ${large} 1 ${oe.x} ${oe.y}`,
                `L ${is.x} ${is.y}`,
                `A ${r0} ${r0} 0 ${large} 0 ${ie.x} ${ie.y}`,
                'Z',
            ].join(' ');
            paths.push({ d, fill });
            a = a1;
        });
        return paths;
    }, [appPerc, decPerc, penPerc]);

    /* Embedded-only: old analytics page CSS still interpolates this; sidebar is not rendered here. */
    const isExpanded = false;

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                * { box-sizing: border-box; margin: 0; padding: 0; }
                .dashboard-analytics-embed { width: 100%; max-width: 100%; overflow-x: hidden; font-family: 'Inter', -apple-system, sans-serif; color: #1B2559; }

                .desktop-sidebar {
                    width: ${isExpanded ? '280px' : '110px'};
                    background: white;
                    border-right: 1px solid #F1F1F1;
                    display: flex;
                    flex-direction: column;
                    align-items: stretch;
                    padding: 25px 0 0;
                    z-index: 100;
                    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    cursor: pointer;
                    position: fixed;
                    top: 0;
                    left: 0;
                    height: 100vh;
                    box-shadow: 4px 0 24px rgba(27, 37, 89, 0.04);
                }
                .sidebar-logo-container { display: flex; justify-content: center; width: 100%; margin-bottom: 28px; align-self: center; }
                .sidebar-logo { width: ${isExpanded ? '120px' : '70px'}; transition: width 0.3s ease; }
                .sidebar-nav-scroll {
                    flex: 1;
                    min-height: 0;
                    overflow-y: auto;
                    width: 100%;
                    display: flex;
                    flex-direction: column;
                }
                .sidebar-nav-item {
                    display: flex;
                    align-items: center;
                    width: 100%;
                    padding: 0 ${isExpanded ? '28px' : '0'};
                    justify-content: ${isExpanded ? 'flex-start' : 'center'};
                    gap: 14px;
                    margin-bottom: 6px;
                    min-height: 48px;
                    box-sizing: border-box;
                }
                .sidebar-label {
                    display: ${isExpanded ? 'block' : 'none'};
                    font-weight: 600;
                    font-size: 15px;
                    color: #707EAE;
                    line-height: 1.25;
                    white-space: normal;
                    max-width: 210px;
                }
                .sidebar-footer {
                    flex-shrink: 0;
                    width: 100%;
                    padding: 16px 0 20px;
                    margin-top: auto;
                    border-top: 1px solid #f1f5f9;
                }
                .icon-box {
                    width: 44px;
                    height: 44px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    transition: all 0.2s;
                    background: #E9EDF7;
                    color: #1B2559;
                }
                .icon-box.active { background: #F54E25; color: white; box-shadow: 0 8px 20px rgba(245, 78, 37, 0.35); }
                .icon-box.inactive { background: transparent; color: #A3AED0; }

                .dashboard-main {
                    flex: 1;
                    min-height: 100vh;
                    margin-left: ${isExpanded ? '280px' : '110px'};
                    transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    padding: 36px 40px 48px;
                }

                .analytics-hero {
                    background: linear-gradient(135deg, #ffffff 0%, #fff9f7 50%, #fef3f0 100%);
                    border: 1px solid rgba(245, 78, 37, 0.12);
                    border-radius: 24px;
                    padding: 28px 32px;
                    margin-bottom: 28px;
                    box-shadow: 0 4px 24px rgba(27, 37, 89, 0.06), 0 0 0 1px rgba(255,255,255,0.8) inset;
                    display: flex;
                    flex-wrap: wrap;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 20px;
                }
                .analytics-hero-text { max-width: 560px; }
                .analytics-kicker {
                    font-size: 11px;
                    font-weight: 800;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                    color: #F54E25;
                    margin-bottom: 10px;
                }
                .analytics-title { font-size: clamp(26px, 3vw, 34px); font-weight: 900; color: #0f172a; letter-spacing: -0.02em; line-height: 1.15; }
                .analytics-sub { font-size: 14px; color: #64748b; margin-top: 10px; font-weight: 500; line-height: 1.5; max-width: 520px; }

                .analytics-hero-badge {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    padding: 12px 18px;
                    box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06);
                }
                .analytics-hero-badge-icon {
                    width: 44px;
                    height: 44px;
                    border-radius: 12px;
                    background: linear-gradient(145deg, #F54E25, #ff7a54);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .analytics-data-hint {
                    font-size: 13px;
                    font-weight: 600;
                    color: #475569;
                    background: #f1f5f9;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 12px 16px;
                    margin-bottom: 20px;
                    line-height: 1.45;
                }

                .filters-export-panel {
                    background: white;
                    border-radius: 20px;
                    padding: 22px 26px;
                    border: 1px solid #e8ecf4;
                    box-shadow: 0 8px 30px rgba(27, 37, 89, 0.07);
                    margin-bottom: 28px;
                    position: relative;
                    overflow: hidden;
                }
                .filters-export-panel::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 4px;
                    background: linear-gradient(90deg, #F54E25, #ff8a65, #2563eb);
                }
                .f-title-wrap { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }
                .f-title { font-size: 15px; font-weight: 800; color: #0f172a; }
                .f-title-hint { font-size: 12px; color: #94a3b8; font-weight: 600; }

                .dropdown {
                    padding: 10px 14px;
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    font-size: 12px;
                    font-weight: 700;
                    color: #475569;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: white;
                    cursor: pointer;
                    transition: border-color 0.15s, box-shadow 0.15s;
                }
                .dropdown:hover { border-color: #cbd5e1; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06); }

                .btn-export {
                    padding: 10px 16px;
                    border-radius: 10px;
                    font-size: 12px;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    transition: transform 0.15s, box-shadow 0.15s;
                }
                .btn-export--ghost {
                    border: 1px solid #e2e8f0;
                    background: white;
                    color: #334155;
                }
                .btn-export--ghost:hover { background: #f8fafc; border-color: #cbd5e1; }
                .btn-export--primary {
                    border: none;
                    background: linear-gradient(145deg, #F54E25, #e84620);
                    color: white;
                    box-shadow: 0 4px 14px rgba(245, 78, 37, 0.35);
                }
                .btn-export--primary:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(245, 78, 37, 0.4); }
                .btn-export--dark {
                    border: none;
                    background: #1e293b;
                    color: white;
                }
                .btn-export--dark:hover { background: #334155; }

                .analytics-filter-select {
                    padding: 10px 30px 10px 14px;
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    font-size: 12px;
                    font-weight: 700;
                    color: #475569;
                    background-color: white;
                    cursor: pointer;
                    appearance: none;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: right 10px center;
                    max-width: 220px;
                }
                .analytics-filter-select:hover { border-color: #cbd5e1; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06); }
                .analytics-filter-select:focus { outline: none; border-color: #F54E25; box-shadow: 0 0 0 2px rgba(245, 78, 37, 0.15); }
                .filters-toolbar-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; flex-wrap: wrap; }
                .filters-toolbar-left { display: flex; gap: 10px; flex-wrap: wrap; flex: 1; min-width: 0; align-items: center; }
                .filters-toolbar-right { display: flex; gap: 10px; flex-wrap: wrap; flex-shrink: 0; align-items: center; }

                @media print {
                    .desktop-sidebar, .db-mobile-only { display: none !important; }
                    .dashboard-main { margin-left: 0 !important; padding: 12px !important; }
                    .filters-toolbar-right { display: none !important; }
                    .analytics-data-hint { display: none !important; }
                    .analytics-print-root { max-width: 100% !important; }
                }

                .stats-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 18px; margin-bottom: 24px; }
                .stat-box {
                    background: white;
                    border-radius: 20px;
                    padding: 22px 20px;
                    border: 1px solid #e8ecf4;
                    box-shadow: 0 4px 20px rgba(27, 37, 89, 0.05);
                    position: relative;
                    overflow: hidden;
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .stat-box:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(27, 37, 89, 0.1); }
                .stat-box::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 3px;
                    border-radius: 20px 20px 0 0;
                }
                .stat-box--t1::after { background: linear-gradient(90deg, #2563eb, #7c3aed); }
                .stat-box--t2::after { background: linear-gradient(90deg, #059669, #10b981); }
                .stat-box--t3::after { background: linear-gradient(90deg, #d97706, #f59e0b); }
                .stat-box--t4::after { background: linear-gradient(90deg, #7c3aed, #a855f7); }
                .stat-box--t5::after { background: linear-gradient(90deg, #F54E25, #fb923c); }

                .stat-label-s { font-size: 14px; color: #64748b; font-weight: 700; margin-bottom: 8px; letter-spacing: 0.02em; }
                .stat-val-s { font-size: 34px; font-weight: 900; color: #0f172a; letter-spacing: -0.03em; line-height: 1.1; }

                .insights-chart-box {
                    background: white;
                    border-radius: 22px;
                    padding: 26px 30px;
                    border: 1px solid #e8ecf4;
                    box-shadow: 0 8px 28px rgba(27, 37, 89, 0.06);
                    margin-bottom: 26px;
                }
                .insights-grid {
                    margin-top: 20px;
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 18px;
                }
                .insight-card {
                    border: 1px solid #e2e8f0;
                    border-radius: 14px;
                    padding: 16px 16px 14px;
                    background: #f8fafc;
                }
                .insight-label {
                    font-size: 12px;
                    color: #64748b;
                    font-weight: 700;
                    margin-bottom: 8px;
                }
                .insight-value {
                    font-size: 26px;
                    font-weight: 900;
                    color: #0f172a;
                    line-height: 1.1;
                    margin-bottom: 6px;
                }
                .insight-sub {
                    font-size: 11px;
                    color: #475569;
                    font-weight: 600;
                    line-height: 1.4;
                }

                .charts-row { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 24px; margin-bottom: 26px; }
                .mini-charts-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px; margin-bottom: 26px; }
                .mini-chart-box {
                    background: white;
                    border-radius: 20px;
                    padding: 22px 24px;
                    border: 1px solid #e8ecf4;
                    box-shadow: 0 10px 28px rgba(27, 37, 89, 0.07);
                    position: relative;
                    overflow: hidden;
                }
                .mini-chart-box::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 3px;
                    background: linear-gradient(90deg, #F54E25, #ff8a65, #fb923c);
                }
                .mini-chart-title {
                    font-size: 16px;
                    font-weight: 800;
                    color: #0f172a;
                    margin-bottom: 4px;
                }
                .mini-chart-subtitle {
                    font-size: 12px;
                    font-weight: 600;
                    color: #64748b;
                    margin-bottom: 16px;
                }
                .mini-bars {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 14px;
                    align-items: end;
                    min-height: 170px;
                    padding: 20px 6px 14px;
                    border-top: 1px dashed #e2e8f0;
                    border-bottom: 1px solid #e2e8f0;
                    background:
                        repeating-linear-gradient(
                            to top,
                            rgba(226, 232, 240, 0.55) 0px,
                            rgba(226, 232, 240, 0.55) 1px,
                            transparent 1px,
                            transparent 30px
                        );
                }
                .mini-bars--aging {
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                }
                .mini-bar-wrap {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;
                }
                .mini-bar {
                    width: 60px;
                    border-radius: 10px 10px 4px 4px;
                    background: linear-gradient(180deg, #ff8a65 0%, #F54E25 100%);
                    min-height: 6px;
                    box-shadow: 0 6px 16px rgba(245, 78, 37, 0.25);
                    transition: transform 0.16s ease, box-shadow 0.16s ease;
                }
                .mini-bar:hover { transform: translateY(-2px); box-shadow: 0 8px 18px rgba(245, 78, 37, 0.35); }
                .mini-bar-value {
                    font-size: 13px;
                    font-weight: 900;
                    color: #0f172a;
                }
                .mini-bar-label {
                    font-size: 12px;
                    font-weight: 700;
                    color: #64748b;
                    text-align: center;
                    line-height: 1.2;
                }
                .extra-kpi-grid {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 22px;
                    margin-bottom: 26px;
                }
                .occupancy-forecast-wrap {
                    background: white;
                    border: 1px solid #e8ecf4;
                    border-radius: 22px;
                    padding: 28px 28px 30px;
                    box-shadow: 0 14px 36px rgba(27, 37, 89, 0.09);
                    margin-bottom: 30px;
                }
                .occupancy-forecast-wrap .extra-kpi-title {
                    font-size: 18px;
                    font-weight: 800;
                    margin-bottom: 10px;
                    letter-spacing: -0.02em;
                }
                .occupancy-forecast-wrap .extra-kpi-sub {
                    font-size: 14px;
                    line-height: 1.55;
                    margin-bottom: 6px;
                    max-width: 920px;
                }
                .occupancy-forecast-grid {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 20px;
                    margin-top: 10px;
                }
                .occupancy-forecast-tile {
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    padding: 20px 18px 22px;
                    min-height: 128px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    background: linear-gradient(180deg, #fafbff 0%, #ffffff 100%);
                }
                .occupancy-forecast-tile-label {
                    font-size: 12px;
                    font-weight: 800;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    margin-bottom: 10px;
                    line-height: 1.25;
                }
                .occupancy-forecast-tile-value {
                    font-size: 36px;
                    font-weight: 900;
                    color: #0f172a;
                    line-height: 1.05;
                    letter-spacing: -0.03em;
                }
                .occupancy-forecast-tile-sub {
                    font-size: 13px;
                    font-weight: 700;
                    color: #94a3b8;
                    margin-top: 8px;
                }
                .occupancy-forecast-tile--stress {
                    border-color: #fecaca;
                    background: linear-gradient(180deg, #fff7f7 0%, #ffffff 100%);
                }
                .occupancy-forecast-tile--stress .occupancy-forecast-tile-value {
                    color: #b91c1c;
                }
                .occupancy-forecast-tile--relief {
                    border-color: #bbf7d0;
                    background: linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%);
                }
                .occupancy-forecast-tile--relief .occupancy-forecast-tile-value {
                    color: #15803d;
                }
                .occupancy-forecast-tile--net {
                    border-color: #bfdbfe;
                    background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%);
                }
                .occupancy-forecast-tile--net .occupancy-forecast-tile-value {
                    color: #1d4ed8;
                }
                .extra-kpi-card {
                    background: white;
                    border: 1px solid #e8ecf4;
                    border-radius: 20px;
                    padding: 20px 22px;
                    box-shadow: 0 10px 28px rgba(27, 37, 89, 0.07);
                }
                .extra-kpi-title {
                    font-size: 15px;
                    font-weight: 800;
                    color: #0f172a;
                    margin-bottom: 4px;
                }
                .extra-kpi-sub {
                    font-size: 12px;
                    color: #64748b;
                    font-weight: 600;
                    margin-bottom: 14px;
                }
                .kpi-big-number {
                    font-size: 28px;
                    font-weight: 900;
                    color: #0f172a;
                    line-height: 1.1;
                    margin-bottom: 4px;
                }
                .kpi-progress-track {
                    width: 100%;
                    height: 10px;
                    border-radius: 999px;
                    background: #e2e8f0;
                    overflow: hidden;
                    margin-top: 10px;
                }
                .kpi-progress-fill {
                    height: 100%;
                    border-radius: 999px;
                    background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%);
                }
                .tiny-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .tiny-list-row {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto;
                    gap: 10px;
                    align-items: center;
                }
                .tiny-list-label {
                    font-size: 12px;
                    font-weight: 700;
                    color: #334155;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .tiny-list-value {
                    font-size: 12px;
                    font-weight: 800;
                    color: #0f172a;
                }
                .tiny-list-bar {
                    grid-column: 1 / -1;
                    width: 100%;
                    height: 7px;
                    border-radius: 999px;
                    background: #e2e8f0;
                    overflow: hidden;
                }
                .tiny-list-bar-fill {
                    height: 100%;
                    border-radius: 999px;
                    background: linear-gradient(90deg, #60a5fa 0%, #2563eb 100%);
                }
                .tiny-list-bar-fill--danger {
                    background: linear-gradient(90deg, #fb7185 0%, #e11d48 100%);
                }
                .decline-list {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .decline-item-head {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto;
                    gap: 10px;
                    align-items: center;
                }
                .decline-item-label {
                    font-size: 12px;
                    font-weight: 700;
                    color: #334155;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .decline-item-count {
                    font-size: 12px;
                    font-weight: 800;
                    color: #0f172a;
                }
                .decline-item-track {
                    width: 100%;
                    height: 7px;
                    border-radius: 999px;
                    background: #e2e8f0;
                    overflow: hidden;
                }
                .decline-item-fill {
                    height: 100%;
                    border-radius: 999px;
                    background: linear-gradient(90deg, #fb7185 0%, #e11d48 100%);
                }
                .warn-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 11px;
                    font-weight: 800;
                    color: #9a3412;
                    background: #fff7ed;
                    border: 1px solid #fed7aa;
                    border-radius: 999px;
                    padding: 4px 10px;
                    margin-bottom: 12px;
                }
                .workload-action-box {
                    margin-top: 12px;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 10px 12px;
                    background: #f8fafc;
                }
                .workload-action-link {
                    margin-top: 8px;
                    border: none;
                    background: #1d4ed8;
                    color: white;
                    border-radius: 8px;
                    font-size: 12px;
                    font-weight: 700;
                    padding: 7px 10px;
                    cursor: pointer;
                }
                .workload-action-link:hover { background: #1e40af; }
                .kpi-note-box {
                    margin-top: 12px;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 10px 12px;
                    background: #f8fafc;
                    font-size: 12px;
                    font-weight: 700;
                    color: #334155;
                    line-height: 1.45;
                }
                .chart-box {
                    background: white;
                    border-radius: 22px;
                    padding: 30px;
                    border: 1px solid #e8ecf4;
                    box-shadow: 0 8px 28px rgba(27, 37, 89, 0.06);
                }
                .chart-head { margin-bottom: 20px; }
                .chart-title { font-size: clamp(20px, 1.6vw, 24px); font-weight: 900; color: #0f172a; letter-spacing: -0.02em; }
                .chart-desc { font-size: 15px; color: #64748b; font-weight: 600; margin-top: 8px; line-height: 1.45; }
                .bar-chart-frame {
                    position: relative;
                    width: 100%;
                    min-height: 280px;
                    padding: 16px 10px 46px 52px;
                }
                .line-chart-frame {
                    position: relative;
                    min-height: 300px;
                    padding: 16px 14px 52px 56px;
                }
                .chart-box--admissions-line .chart-title {
                    font-size: clamp(18px, 1.35vw, 21px);
                }
                .chart-box--admissions-line .chart-desc {
                    font-size: 13px;
                    margin-top: 6px;
                }
                .line-chart-frame .axis-text {
                    fill: #475569;
                    font-size: 11.5px;
                    font-weight: 600;
                }
                .line-chart-frame .axis-text--week {
                    font-size: 11px;
                    font-weight: 600;
                    fill: #64748b;
                }
                .line-chart-frame .chart-axis-caption {
                    font-size: 12px;
                    font-weight: 700;
                    color: #475569;
                }
                .line-chart-frame .chart-axis-caption--y {
                    left: 8px;
                }

                .axis-text {
                    fill: #1e293b;
                    font-size: 15px;
                    font-weight: 800;
                    font-family: 'Inter', sans-serif;
                }
                .chart-axis-caption {
                    font-size: 15px;
                    font-weight: 800;
                    color: #1e293b;
                    letter-spacing: 0.02em;
                }
                .chart-axis-caption--y {
                    position: absolute;
                    left: 0;
                    top: 50%;
                    transform: translateY(-50%) rotate(-90deg);
                    transform-origin: center center;
                    white-space: nowrap;
                }
                .pie-chart-wrap {
                    width: 100%;
                    max-width: 280px;
                    aspect-ratio: 1;
                    margin: 12px auto 0;
                }
                .pie-chart-wrap svg { display: block; width: 100%; height: 100%; filter: drop-shadow(0 8px 24px rgba(15, 23, 42, 0.08)); }
                .donut-legend {
                    font-size: 16px;
                    font-weight: 800;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .db-mobile-only { display: none; }

                .y-axis-label-line {
                    position: absolute;
                    left: -25px;
                    top: 50%;
                    transform: translateY(-50%) rotate(-90deg);
                    font-size: 10px;
                    color: #94a3b8;
                    font-weight: 700;
                }

                .analytics-chart-wrap { position: relative; }

                @media (max-width: 1200px) {
                    .stats-row { grid-template-columns: repeat(3, 1fr); }
                    .insights-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                    .charts-row { grid-template-columns: 1fr; }
                    .mini-charts-row { grid-template-columns: 1fr; }
                    .extra-kpi-grid { grid-template-columns: 1fr; }
                    .occupancy-forecast-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
                    .occupancy-forecast-tile { min-height: 112px; padding: 16px 14px 18px; }
                    .occupancy-forecast-tile-value { font-size: 30px; }
                }

                @media (max-width: 768px) {
                    .desktop-sidebar { display: none !important; }
                    .dashboard-outer { flex-direction: column !important; }
                    .dashboard-main { margin-left: 0 !important; width: 100vw !important; padding: 20px 15px 100px 15px !important; }
                    .db-mobile-only { display: flex !important; }
                    .db-mobile-top-bar { display: flex !important; width: 100vw; background: white; z-index: 1001; position: sticky; top: 0; padding: 0 20px; height: 64px; align-items: center; justify-content: space-between; border-bottom: 1px solid #F1F1F1; }
                    .db-mobile-bottom-nav { position: fixed; bottom: 0; left: 0; width: 100vw; height: 72px; background: white; border-top: 1px solid #F1F1F1; display: flex; justify-content: space-around; align-items: center; z-index: 1000; box-shadow: 0 -4px 20px rgba(0,0,0,0.06); }
                    .mob-nav-item { display: flex; flex-direction: column; align-items: center; font-size: 10px; color: #A3AED0; cursor: pointer; }
                    .mob-nav-item.active { color: #F54E25; }
                    .dropdown, .btn-export { padding: 8px 12px; font-size: 11px; }
                    .stats-row { grid-template-columns: repeat(2, 1fr); }
                    .insights-grid { grid-template-columns: 1fr; }
                    .mini-charts-row { gap: 14px; margin-bottom: 18px; }
                    .occupancy-forecast-grid { grid-template-columns: 1fr; gap: 14px; }
                    .occupancy-forecast-wrap { padding: 20px 18px 22px; }
                    .occupancy-forecast-tile { min-height: 0; padding: 18px 16px; }
                    .occupancy-forecast-tile-value { font-size: 32px; }
                    .mini-chart-box { padding: 16px 14px; }
                    .mini-bars { gap: 10px; padding: 14px 0 10px; min-height: 148px; }
                    .charts-row { gap: 16px; margin-bottom: 18px; }
                    .chart-box { padding: 18px; }
                    .extra-kpi-grid { gap: 14px; margin-bottom: 18px; }
                    .extra-kpi-card { padding: 16px 14px; }
                    .y-axis-label-line { left: -35px !important; }
                    .chart-container-line {
                        margin-left: 15px;
                        width: calc(100% - 15px) !important;
                    }
                }
            `}</style>

            <section id="admin-analytics" className="dashboard-analytics-embed" aria-label="Analytics">
                <div className="analytics-print-root" style={{ maxWidth: 'min(1920px, 100%)', margin: '0 auto', width: '100%' }}>
                    <div className="analytics-hero">
                        <div className="analytics-hero-text">
                            <div className="analytics-kicker">Insights &amp; reporting</div>
                            <div className="analytics-title">Analytics</div>
                            <div className="analytics-sub">
                                Overall hospital performance at a glance—request mix, programs, and trends. Same live metrics from your workspace; export when you need a shareable snapshot.
                            </div>
                        </div>
                        <div className="analytics-hero-badge">
                            <div className="analytics-hero-badge-icon">
                                <Activity size={22} strokeWidth={2.2} />
                            </div>
                            <div>
                                <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', lineHeight: 1.2 }}>{metrics.total}</div>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total requests</div>
                            </div>
                        </div>
                    </div>

                    <div className="analytics-data-hint" role="status">
                        {remoteLoading
                            ? 'Loading analytics from the database…'
                            : loadError
                              ? `Could not reach the database — showing saved browser data. (${loadError})`
                              : isSupabaseConfigured()
                                ? 'Connected to Supabase — metrics reflect your live workspace.'
                                : 'Using browser data — configure Supabase env vars for cloud sync.'}
                    </div>

                    <div className="filters-export-panel">
                        <div className="f-title-wrap">
                            <PieChart size={18} color="#F54E25" strokeWidth={2.2} />
                            <div>
                                <div className="f-title">Filters &amp; export</div>
                                <div className="f-title-hint">Refine the view before exporting PDF, CSV, or printing.</div>
                            </div>
                        </div>
                        <div className="filters-toolbar-row">
                            <div className="filters-toolbar-left">
                                <select
                                    className="analytics-filter-select"
                                    value={filterPeriod}
                                    onChange={(e) => setFilterPeriod(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    aria-label="Reporting period"
                                >
                                    {PERIOD_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                                <select
                                    className="analytics-filter-select"
                                    value={filterProgram}
                                    onChange={(e) => setFilterProgram(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    aria-label="Program"
                                >
                                    {PROGRAM_FILTER_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                                <select
                                    className="analytics-filter-select"
                                    value={filterGender}
                                    onChange={(e) => setFilterGender(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    aria-label="Gender"
                                >
                                    {GENDER_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                                <select
                                    className="analytics-filter-select"
                                    value={filterAge}
                                    onChange={(e) => setFilterAge(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    aria-label="Age range"
                                >
                                    {AGE_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                                <select
                                    className="analytics-filter-select"
                                    value={filterTherapist}
                                    onChange={(e) => setFilterTherapist(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    aria-label="Therapist"
                                >
                                    {therapistOptions.map((v) => (
                                        <option key={v} value={v}>{v === 'all' ? 'All Therapist' : v}</option>
                                    ))}
                                </select>
                                <select
                                    className="analytics-filter-select"
                                    value={filterOutcome}
                                    onChange={(e) => setFilterOutcome(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    aria-label="Outcome"
                                >
                                    {OUTCOME_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="filters-toolbar-right">
                                <button type="button" className="btn-export btn-export--primary" onClick={(e) => { e.stopPropagation(); handleExportPdf(); }}>
                                    <FileText size={16} /> Export PDF
                                </button>
                                <button type="button" className="btn-export btn-export--dark" onClick={(e) => { e.stopPropagation(); exportCsv(); }}>
                                    <Download size={16} /> Export CSV
                                </button>
                                <button type="button" className="btn-export btn-export--ghost" onClick={(e) => { e.stopPropagation(); handlePrint(); }}>
                                    <Printer size={16} /> Print
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="stats-row">
                        <div className="stat-box stat-box--t1">
                            <div className="stat-label-s">Total Requests</div>
                            <div className="stat-val-s">{metrics.total}</div>
                        </div>
                        <div className="stat-box stat-box--t2">
                            <div className="stat-label-s">Approved</div>
                            <div className="stat-val-s">{metrics.approved}</div>
                        </div>
                        <div className="stat-box stat-box--t3">
                            <div className="stat-label-s">Average Stay Duration</div>
                            <div className="stat-val-s">{avgStayDays} days</div>
                        </div>
                        <div className="stat-box stat-box--t4">
                            <div className="stat-label-s">Success Rate</div>
                            <div className="stat-val-s">{successRateInfo.percent != null ? `${successRateInfo.percent}%` : '—'}</div>
                        </div>
                        <div className="stat-box stat-box--t5">
                            <div className="stat-label-s">Active Users</div>
                            <div className="stat-val-s">{metrics.approved}</div>
                        </div>
                    </div>

                    <div className="insights-chart-box">
                        <div className="chart-head" style={{ marginBottom: 10 }}>
                            <div className="chart-title">Insights Chart</div>
                            <div className="chart-desc">Snapshot of core insight metrics from recent activity windows</div>
                        </div>
                        <div className="insights-grid">
                            <div className="insight-card">
                                <div className="insight-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <TrendingUp size={14} color="#0d7a45" /> Approval Share
                                </div>
                                <div className="insight-value">{insights.currentSuccessRate}%</div>
                                <div className="insight-sub">{insights.successText}</div>
                            </div>
                            <div className="insight-card">
                                <div className="insight-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <AlertTriangle size={14} color="#ea580c" /> Peak Day Load
                                </div>
                                <div className="insight-value">{insights.peakDayCount}</div>
                                <div className="insight-sub">{insights.noShowText}</div>
                            </div>
                            <div className="insight-card">
                                <div className="insight-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Star size={14} color="#1d4ed8" /> Best Program Completion
                                </div>
                                <div className="insight-value">{insights.bestProgRate}%</div>
                                <div className="insight-sub">{insights.programText}</div>
                            </div>
                            <div className="insight-card">
                                <div className="insight-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Clock size={14} color="#0f766e" /> Avg Stay Delta
                                </div>
                                <div className="insight-value">{insights.stayDelta == null ? '—' : `${insights.stayDelta > 0 ? '+' : ''}${insights.stayDelta}`}</div>
                                <div className="insight-sub">{insights.stayText}</div>
                            </div>
                        </div>
                    </div>

                    <div className="mini-charts-row">
                        <div className="mini-chart-box">
                            <div className="mini-chart-title">Admission Funnel</div>
                            <div className="mini-chart-subtitle">Status volume in the selected filter window</div>
                            <div className="mini-bars">
                                {[
                                    { key: 'submitted', label: 'Submitted', value: admissionFunnel.submitted, gradient: 'linear-gradient(180deg, #fb923c 0%, #f97316 100%)' },
                                    { key: 'approved', label: 'Approved', value: admissionFunnel.approved, gradient: 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)' },
                                    { key: 'pending', label: 'Pending', value: admissionFunnel.pending, gradient: 'linear-gradient(180deg, #38bdf8 0%, #0284c7 100%)' },
                                    { key: 'declined', label: 'Declined', value: admissionFunnel.declined, gradient: 'linear-gradient(180deg, #f87171 0%, #dc2626 100%)' },
                                ].map((item) => {
                                    const max = Math.max(1, admissionFunnel.submitted, admissionFunnel.approved, admissionFunnel.pending, admissionFunnel.declined);
                                    const h = Math.max(8, Math.round((item.value / max) * 110));
                                    return (
                                        <div key={item.key} className="mini-bar-wrap">
                                            <div className="mini-bar-value">{item.value}</div>
                                            <div className="mini-bar" style={{ height: h, background: item.gradient }} />
                                            <div className="mini-bar-label">{item.label}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="mini-chart-box">
                            <div className="mini-chart-title">Discharge Queue Aging</div>
                            <div className="mini-chart-subtitle">How long pending discharge requests have been waiting</div>
                            <div className="mini-bars mini-bars--aging">
                                {[
                                    { key: '0-2d', label: '0-2 days', value: dischargeQueueAging['0-2d'], gradient: 'linear-gradient(180deg, #22c55e 0%, #15803d 100%)' },
                                    { key: '3-7d', label: '3-7 days', value: dischargeQueueAging['3-7d'], gradient: 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)' },
                                    { key: '8+d', label: '8+ days', value: dischargeQueueAging['8+d'], gradient: 'linear-gradient(180deg, #ef4444 0%, #b91c1c 100%)' },
                                ].map((item) => {
                                    const max = Math.max(1, dischargeQueueAging['0-2d'], dischargeQueueAging['3-7d'], dischargeQueueAging['8+d']);
                                    const h = Math.max(8, Math.round((item.value / max) * 110));
                                    return (
                                        <div key={item.key} className="mini-bar-wrap">
                                            <div className="mini-bar-value">{item.value}</div>
                                            <div className="mini-bar" style={{ height: h, background: item.gradient }} />
                                            <div className="mini-bar-label">{item.label}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="extra-kpi-grid">
                        <div className="extra-kpi-card">
                            <div className="extra-kpi-title">Occupancy</div>
                            <div className="extra-kpi-sub">Facility utilization from active patients and fixed bed capacity</div>
                            <div className="kpi-big-number">{occupancyKpi.occupancyPercent}%</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>
                                {occupancyKpi.activeCount}/{occupancyKpi.bedCapacity} occupied · {occupancyKpi.availableBeds} beds available
                            </div>
                            <div className="kpi-progress-track">
                                <div className="kpi-progress-fill" style={{ width: `${Math.min(100, occupancyKpi.occupancyPercent)}%` }} />
                            </div>
                            <div className="kpi-note-box">
                                Formula: Occupancy % = active patients / bed capacity * 100. Available beds = capacity - active patients.
                            </div>
                        </div>

                        <div className="extra-kpi-card">
                            <div className="extra-kpi-title">Staff Workload</div>
                            <div className="extra-kpi-sub">Active patients currently assigned per staff</div>
                            {staffWorkload.unassignedCount >= 3 || staffWorkload.unassignedPercent >= 30 ? (
                                <div className="warn-pill">
                                    <AlertTriangle size={12} />
                                    High unassigned load: {staffWorkload.unassignedCount}/{staffWorkload.total} ({staffWorkload.unassignedPercent}%)
                                </div>
                            ) : null}
                            <div className="tiny-list">
                                {staffWorkload.rows.length === 0 ? (
                                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>No active assignments in this filter.</div>
                                ) : staffWorkload.rows.map((row) => (
                                    <div key={row.name} className="tiny-list-row">
                                        <div className="tiny-list-label">{row.displayName}</div>
                                        <div className="tiny-list-value">{row.count}</div>
                                        <div className="tiny-list-bar">
                                            <div
                                                className="tiny-list-bar-fill"
                                                style={{ width: `${Math.max(8, Math.round((row.count / Math.max(1, staffWorkload.max)) * 100))}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {staffWorkload.unassignedCount > 0 ? (
                                <div className="workload-action-box">
                                    <div style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                                        Unassigned patients: {staffWorkload.unassignedPatients.join(', ')}
                                        {staffWorkload.unassignedCount > staffWorkload.unassignedPatients.length ? ', ...' : ''}
                                    </div>
                                    <button
                                        type="button"
                                        className="workload-action-link"
                                        onClick={() => navigate('/admin-patient-database')}
                                    >
                                        Review in Patient Management
                                    </button>
                                </div>
                            ) : null}
                        </div>

                        <div className="extra-kpi-card">
                            <div className="extra-kpi-title">Decline Reason Breakdown</div>
                            <div className="extra-kpi-sub">Top reasons from declined admission/discharge requests</div>
                            <div className="decline-list">
                                {declineReasonBreakdown.rows.length === 0 ? (
                                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>No declined requests for this filter.</div>
                                ) : declineReasonBreakdown.rows.map((row) => (
                                    <div key={row.reason}>
                                        <div className="decline-item-head">
                                            <div className="decline-item-label">{row.reason}</div>
                                            <div className="decline-item-count">{row.count}</div>
                                        </div>
                                        <div className="decline-item-track" style={{ marginTop: 6 }}>
                                            <div
                                                className="decline-item-fill"
                                                style={{ width: `${Math.max(8, Math.round((row.count / Math.max(1, declineReasonBreakdown.total)) * 100))}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="kpi-note-box">
                                Note: Reasons are grouped and normalized from declined admission/discharge entries to highlight the most common causes.
                            </div>
                        </div>
                    </div>

                    <div className="occupancy-forecast-wrap">
                        <div className="extra-kpi-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <TrendingUp size={24} color="#1d4ed8" strokeWidth={2.25} aria-hidden />
                            Occupancy forecast (next 7 days)
                        </div>
                        <div className="extra-kpi-sub">
                            Pipeline view: uses current census ({occupancyKpi.activeCount}/{occupancyKpi.bedCapacity}) plus{' '}
                            <strong>{occupancyForecast.pendingAdmissions}</strong> pending admission(s) and{' '}
                            <strong>{occupancyForecast.pendingDischarges}</strong> pending discharge(s) in this filter. Assumes decisions land within a typical weekly planning window — not exact admit/discharge dates.
                        </div>
                        <div className="occupancy-forecast-grid">
                            <div className="occupancy-forecast-tile occupancy-forecast-tile--stress">
                                <div className="occupancy-forecast-tile-label">If all admits clear</div>
                                <div className="occupancy-forecast-tile-value">{occupancyForecast.ifAllAdmits}</div>
                                <div className="occupancy-forecast-tile-sub">{occupancyForecast.pctAdmits}% of capacity</div>
                            </div>
                            <div className="occupancy-forecast-tile occupancy-forecast-tile--relief">
                                <div className="occupancy-forecast-tile-label">If all discharges clear</div>
                                <div className="occupancy-forecast-tile-value">{occupancyForecast.ifAllDischarges}</div>
                                <div className="occupancy-forecast-tile-sub">{occupancyForecast.pctDischarges}% of capacity</div>
                            </div>
                            <div className="occupancy-forecast-tile occupancy-forecast-tile--net">
                                <div className="occupancy-forecast-tile-label">Net if both clear</div>
                                <div className="occupancy-forecast-tile-value">{occupancyForecast.netIfAll}</div>
                                <div className="occupancy-forecast-tile-sub">{occupancyForecast.pctNet}% of capacity</div>
                            </div>
                            <div className="occupancy-forecast-tile">
                                <div className="occupancy-forecast-tile-label">Available beds now</div>
                                <div className="occupancy-forecast-tile-value">{occupancyKpi.availableBeds}</div>
                                <div className="occupancy-forecast-tile-sub">After net: {Math.max(0, occupancyKpi.bedCapacity - occupancyForecast.netIfAll)} free</div>
                            </div>
                        </div>
                        <div className="kpi-note-box" style={{ marginTop: 22, fontSize: 13, padding: '14px 16px' }}>
                            Formula: each scenario clamps to 0–{BED_CAPACITY} beds. “Net if both clear” = current + pending admissions − pending discharges (same cohort filters as the Occupancy card above).
                        </div>
                    </div>

                    <div className="charts-row">
                        <div className="chart-box">
                            <div className="chart-head">
                                <div className="chart-title">Patients per Program</div>
                                <div className="chart-desc">Volume by program cohort</div>
                            </div>
                            <div className="analytics-chart-wrap bar-chart-frame">
                                <div className="chart-axis-caption chart-axis-caption--y">Number of Patients</div>
                                <div
                                    className="chart-axis-caption"
                                    style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)' }}
                                >
                                    Programs
                                </div>

                                <svg width="100%" height="220" viewBox="0 0 500 200" preserveAspectRatio="xMidYMid meet">
                                    <defs>
                                        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#ff8a65" />
                                            <stop offset="100%" stopColor="#F54E25" />
                                        </linearGradient>
                                    </defs>
                                    {barTickVals.map((val) => (
                                        <g key={val}>
                                            <text
                                                x="30"
                                                y={155 - (val / barAxisMax) * 120}
                                                className="axis-text"
                                                textAnchor="end"
                                                fontSize="12"
                                            >
                                                {val}
                                            </text>
                                            <line
                                                x1="40"
                                                y1={150 - (val / barAxisMax) * 120}
                                                x2="500"
                                                y2={150 - (val / barAxisMax) * 120}
                                                stroke="#f1f5f9"
                                                strokeDasharray="4 4"
                                            />
                                        </g>
                                    ))}
                                    <line x1="40" y1="150" x2="500" y2="150" stroke="#e2e8f0" strokeWidth="2" />

                                    <rect
                                        x="45"
                                        y={150 - barScale(barCounts.drugs)}
                                        width="65"
                                        height={barScale(barCounts.drugs)}
                                        fill="url(#barGrad)"
                                        rx="6"
                                        style={{ cursor: 'pointer', opacity: selectedProgramKey === 'drugs' ? 1 : 0.8 }}
                                        onClick={() => setSelectedProgramKey('drugs')}
                                    />
                                    <text
                                        x="77.5"
                                        y={Math.max(14, 144 - barScale(barCounts.drugs))}
                                        className="axis-text"
                                        textAnchor="middle"
                                        fontSize="12"
                                        fontWeight="800"
                                        fill={selectedProgramKey === 'drugs' ? '#0f172a' : '#334155'}
                                    >
                                        {barCounts.drugs}
                                    </text>
                                    <rect
                                        x="135"
                                        y={150 - barScale(barCounts.alcohol)}
                                        width="65"
                                        height={barScale(barCounts.alcohol)}
                                        fill="url(#barGrad)"
                                        rx="6"
                                        style={{ cursor: 'pointer', opacity: selectedProgramKey === 'alcohol' ? 1 : 0.8 }}
                                        onClick={() => setSelectedProgramKey('alcohol')}
                                    />
                                    <text
                                        x="167.5"
                                        y={Math.max(14, 144 - barScale(barCounts.alcohol))}
                                        className="axis-text"
                                        textAnchor="middle"
                                        fontSize="12"
                                        fontWeight="800"
                                        fill={selectedProgramKey === 'alcohol' ? '#0f172a' : '#334155'}
                                    >
                                        {barCounts.alcohol}
                                    </text>
                                    <rect
                                        x="225"
                                        y={150 - barScale(barCounts.gambling)}
                                        width="65"
                                        height={barScale(barCounts.gambling)}
                                        fill="url(#barGrad)"
                                        rx="6"
                                        style={{ cursor: 'pointer', opacity: selectedProgramKey === 'gambling' ? 1 : 0.8 }}
                                        onClick={() => setSelectedProgramKey('gambling')}
                                    />
                                    <text
                                        x="257.5"
                                        y={Math.max(14, 144 - barScale(barCounts.gambling))}
                                        className="axis-text"
                                        textAnchor="middle"
                                        fontSize="12"
                                        fontWeight="800"
                                        fill={selectedProgramKey === 'gambling' ? '#0f172a' : '#334155'}
                                    >
                                        {barCounts.gambling}
                                    </text>
                                    <rect
                                        x="315"
                                        y={150 - barScale(barCounts.mental_health)}
                                        width="65"
                                        height={barScale(barCounts.mental_health)}
                                        fill="url(#barGrad)"
                                        rx="6"
                                        style={{ cursor: 'pointer', opacity: selectedProgramKey === 'mental_health' ? 1 : 0.8 }}
                                        onClick={() => setSelectedProgramKey('mental_health')}
                                    />
                                    <text
                                        x="347.5"
                                        y={Math.max(14, 144 - barScale(barCounts.mental_health))}
                                        className="axis-text"
                                        textAnchor="middle"
                                        fontSize="12"
                                        fontWeight="800"
                                        fill={selectedProgramKey === 'mental_health' ? '#0f172a' : '#334155'}
                                    >
                                        {barCounts.mental_health}
                                    </text>

                                    <g transform="translate(77.5, 176)">
                                        <text className="axis-text" textAnchor="middle" fontSize="11">
                                            Drugs
                                        </text>
                                    </g>
                                    <g transform="translate(167.5, 176)">
                                        <text className="axis-text" textAnchor="middle" fontSize="11">
                                            Alcohol
                                        </text>
                                    </g>
                                    <g transform="translate(257.5, 176)">
                                        <text className="axis-text" textAnchor="middle" fontSize="11">
                                            Gambling
                                        </text>
                                    </g>
                                    <g transform="translate(347.5, 176)">
                                        <text className="axis-text" textAnchor="middle" fontSize="11">
                                            <tspan x="0" dy="0">Mental</tspan>
                                            <tspan x="0" dy="13">health</tspan>
                                        </text>
                                    </g>
                                </svg>
                            </div>
                            <div
                                style={{
                                    marginTop: 12,
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 12,
                                    padding: '12px 14px',
                                    background: '#f8fafc',
                                }}
                            >
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>
                                    Selected concern
                                </div>
                                <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', marginBottom: 6 }}>
                                    {selectedProgramKey === 'mental_health'
                                        ? 'Mental health'
                                        : selectedProgramKey.charAt(0).toUpperCase() + selectedProgramKey.slice(1)}
                                    : {selectedProgramPatients.length} patient(s)
                                </div>
                                <div style={{ fontSize: 12, color: '#475569', fontWeight: 600, lineHeight: 1.45 }}>
                                    {selectedProgramPatients.length > 0
                                        ? `Patients: ${selectedProgramPatients.slice(0, 8).map((p) => p.name).join(', ')}${selectedProgramPatients.length > 8 ? ', ...' : ''}`
                                        : 'No patients under this concern for the current filters.'}
                                </div>
                            </div>
                        </div>

                        <div className="chart-box" style={{ display: 'flex', flexDirection: 'column' }}>
                            <div className="chart-head">
                                <div className="chart-title">Request Status Distribution</div>
                                <div className="chart-desc">Approved / declined / pending</div>
                            </div>
                            <div className="pie-chart-wrap" style={{ flex: '0 0 auto' }}>
                                <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Request status distribution">
                                    <defs>
                                        <linearGradient id="donutShadow" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
                                            <stop offset="100%" stopColor="#f8fafc" stopOpacity="0.9" />
                                        </linearGradient>
                                    </defs>
                                    <circle cx="100" cy="100" r="88" fill="url(#donutShadow)" />
                                    {donutPaths.map((p, i) => (
                                        <path key={i} d={p.d} fill={p.fill} stroke="#ffffff" strokeWidth="2.5" />
                                    ))}
                                    <text x="100" y="96" textAnchor="middle" fill="#0f172a" fontSize="28" fontWeight="900" fontFamily="Inter, sans-serif">
                                        {metrics.total}
                                    </text>
                                    <text x="100" y="122" textAnchor="middle" fill="#64748b" fontSize="14" fontWeight="700" fontFamily="Inter, sans-serif">
                                        requests
                                    </text>
                                </svg>
                            </div>
                            <div style={{ display: 'flex', gap: '22px', justifyContent: 'center', marginTop: '18px', flexWrap: 'wrap' }}>
                                <span className="donut-legend" style={{ color: '#0d7a45' }}>
                                    <span style={{ width: 14, height: 14, background: '#0d7a45', borderRadius: '4px', flexShrink: 0 }} />
                                    Approved ({appPerc}%)
                                </span>
                                <span className="donut-legend" style={{ color: '#ea580c' }}>
                                    <span style={{ width: 14, height: 14, background: '#ea580c', borderRadius: '4px', flexShrink: 0 }} />
                                    Declined ({decPerc}%)
                                </span>
                                <span className="donut-legend" style={{ color: '#2563eb' }}>
                                    <span style={{ width: 14, height: 14, background: '#2563eb', borderRadius: '4px', flexShrink: 0 }} />
                                    Pending ({penPerc}%)
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="chart-box chart-box--admissions-line">
                            <div className="chart-head">
                                <div className="chart-title">Admissions Over Time</div>
                                <div className="chart-desc">Weekly trend (last 8 weeks), cohort matches filters above</div>
                            </div>
                        <div className="analytics-chart-wrap line-chart-frame">
                            <div className="chart-axis-caption chart-axis-caption--y">
                                Number of Admissions
                            </div>
                            <div
                                className="chart-axis-caption"
                                style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)' }}
                            >
                                Date
                            </div>

                            <div className="chart-container-line" style={{ width: '100%', height: '100%', overflow: 'visible', minHeight: 220 }}>
                                <svg width="100%" height="100%" viewBox="0 0 1000 200" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                                    <defs>
                                        <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#F54E25" stopOpacity="0.35" />
                                            <stop offset="100%" stopColor="#F54E25" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                    {yTicks.map((val) => (
                                        <g key={val}>
                                            <text x="40" y={165 - (lineSeries.maxY > 0 ? (val / lineSeries.maxY) * 120 : 0)} className="axis-text" textAnchor="end">{val}</text>
                                            <line
                                                x1="50"
                                                y1={160 - (lineSeries.maxY > 0 ? (val / lineSeries.maxY) * 120 : 0)}
                                                x2="980"
                                                y2={160 - (lineSeries.maxY > 0 ? (val / lineSeries.maxY) * 120 : 0)}
                                                stroke="#f1f5f9"
                                                strokeDasharray="4 4"
                                            />
                                        </g>
                                    ))}
                                    <line x1="50" y1="160" x2="980" y2="160" stroke="#e2e8f0" strokeWidth="2" />

                                    {linePathD && (
                                        <path d={linePathD} fill="url(#lineAreaGrad)" opacity="0.95" />
                                    )}
                                    {lineStrokeD && (
                                        <path
                                            d={lineStrokeD}
                                            stroke="#F54E25"
                                            strokeWidth="3.5"
                                            fill="none"
                                            strokeLinecap="round"
                                            filter="drop-shadow(0 2px 6px rgba(245, 78, 37, 0.35))"
                                        />
                                    )}

                                    {linePoints.map((pt, i) => (
                                        <circle key={i} cx={pt.x} cy={pt.y} r="6" fill="white" stroke="#F54E25" strokeWidth="2.5" />
                                    ))}

                                    {[1, 2, 3, 4, 5, 6, 7, 8].map((wk, i) => (
                                        <text key={i} x={50 + i * 128} y="186" className="axis-text axis-text--week" textAnchor="middle">
                                            Week {wk}
                                        </text>
                                    ))}
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}
