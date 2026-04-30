import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { APP_DATA_REFRESH } from '@/lib/appDataRefresh';
import {
  STAFF_ASSIGNMENT_STORAGE_KEY,
  CLM_WEEKLY_REPORTS_KEY,
  GUARDIAN_CONSOLIDATED_KEY,
  CLM_INCIDENT_LOG_KEY,
  EMPTY_FORM,
  readJson,
  normalizeName,
  displayNameFromEmail,
  weekNumberNow,
  normalizeAppointmentStatus,
  patientMatchesClm,
  loadLadderProfiles,
  saveLadderProfiles,
  mergeStaffAssignmentFields,
  mergeClmReportsMap,
  mergeClmIncidentsList,
  clmReportToInsertPayload,
  clmIncidentToInsertPayload,
} from './clmUtils';

const CaseLoadContext = createContext(null);

export function useCaseLoad() {
  const ctx = useContext(CaseLoadContext);
  if (!ctx) throw new Error('useCaseLoad must be used within CaseLoadProvider');
  return ctx;
}

export function CaseLoadProvider({ children }) {
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [me, setMe] = useState({ fullName: 'Case Load Manager', email: '' });
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [reportForm, setReportForm] = useState({ ...EMPTY_FORM, weekNumber: String(weekNumberNow()) });
  const [allReports, setAllReports] = useState({});
  const [appointments, setAppointments] = useState([]);
  const [incidentLog, setIncidentLog] = useState([]);
  const [incidentDraft, setIncidentDraft] = useState({
    behaviorType: '',
    severity: 'intervention_only',
    intervention: '',
    note: '',
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setFormError('');
      try {
        let meInfo = { fullName: 'Case Load Manager', email: '' };
        if (isSupabaseConfigured()) {
          const { data: authData } = await supabase.auth.getUser();
          const user = authData?.user;
          if (user) {
            meInfo = {
              fullName: user.user_metadata?.full_name || displayNameFromEmail(user.email) || 'Case Load Manager',
              email: user.email || '',
            };
            const { data: profRow } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', user.id)
              .maybeSingle();
            const profName = profRow?.full_name?.trim();
            if (profName) {
              meInfo = { ...meInfo, fullName: profName };
            }
          }
        }
        setMe(meInfo);

        const assignmentMap = readJson(STAFF_ASSIGNMENT_STORAGE_KEY, {});
        const localReports = readJson(CLM_WEEKLY_REPORTS_KEY, {});
        const assignedPatientIdsFromOverrides = new Set(
          Object.entries(assignmentMap || {})
            .filter(([, v]) => patientMatchesClm(v?.caseLoadManager, meInfo))
            .map(([pid]) => String(pid))
        );

        const mapLocalPatients = () => {
          const localPatients = readJson('bh_patients', []);
          return (Array.isArray(localPatients) ? localPatients : [])
            .filter((p) => !p.discharged_at && p.status !== 'Discharged')
            .map((p) => {
              const staff = mergeStaffAssignmentFields(p.id, assignmentMap, p);
              return {
                id: String(p.id),
                name: p.name || p.full_name || 'Patient',
                concern: p.primary_concern || p.concern || '—',
                admittedAt: p.admitted_at || p.admissionDate || '',
                clinicalStatus: p.clinical_status || p.clinicalStatus || p.status || 'Admitted',
                caseLoadManager: staff.caseLoadManager,
                programStaff: staff.programStaff,
              };
            });
        };

        let rows = [];
        if (isSupabaseConfigured()) {
          const { data, error } = await supabase
            .from('patients')
            .select('id, full_name, primary_concern, admitted_at, discharged_at, clinical_status, case_load_manager, program_staff')
            .is('discharged_at', null)
            .order('admitted_at', { ascending: false });
          if (error) throw error;
          rows = (data || []).map((r) => {
            const staff = mergeStaffAssignmentFields(r.id, assignmentMap, r);
            return {
              id: String(r.id),
              name: r.full_name || 'Patient',
              concern: r.primary_concern || '—',
              admittedAt: r.admitted_at || '',
              clinicalStatus: r.clinical_status || 'Admitted',
              caseLoadManager: staff.caseLoadManager,
              programStaff: staff.programStaff,
            };
          });
          if (!rows.length) {
            // Fallback for environments where CLM session sees no patient rows (RLS / sync lag).
            rows = mapLocalPatients();
          }
        } else {
          rows = mapLocalPatients();
        }

        const finalRows = rows.filter((p) => (
          patientMatchesClm(p.caseLoadManager, meInfo)
          || assignedPatientIdsFromOverrides.has(String(p.id))
        ));
        setPatients(finalRows);
        const nameById = Object.fromEntries(finalRows.map((p) => [String(p.id), p.name]));
        const pidSet = new Set(finalRows.map((p) => String(p.id)));
        const localIncidents = Array.isArray(readJson(CLM_INCIDENT_LOG_KEY, [])) ? readJson(CLM_INCIDENT_LOG_KEY, []) : [];

        let mergedReports = localReports && typeof localReports === 'object' ? localReports : {};
        let mergedIncidents = localIncidents;

        if (isSupabaseConfigured() && finalRows.length) {
          const pids = finalRows.map((p) => p.id);
          try {
            const { data: repData, error: repErr } = await supabase
              .from('clm_weekly_reports')
              .select('*')
              .in('patient_id', pids)
              .order('submitted_at', { ascending: false });
            if (repErr) throw repErr;
            mergedReports = mergeClmReportsMap(mergedReports, repData || [], nameById);
            localStorage.setItem(CLM_WEEKLY_REPORTS_KEY, JSON.stringify(mergedReports));
          } catch (e) {
            console.warn('[CLM] clm_weekly_reports fetch:', e?.message || e);
            mergedReports = localReports && typeof localReports === 'object' ? localReports : {};
          }
          try {
            const { data: incData, error: incErr } = await supabase
              .from('clm_incidents')
              .select('*')
              .in('patient_id', pids)
              .order('created_at', { ascending: false });
            if (incErr) throw incErr;
            mergedIncidents = mergeClmIncidentsList(localIncidents, incData || [], pidSet, nameById);
            localStorage.setItem(CLM_INCIDENT_LOG_KEY, JSON.stringify(mergedIncidents));
          } catch (e) {
            console.warn('[CLM] clm_incidents fetch:', e?.message || e);
            mergedIncidents = localIncidents;
          }
        }

        setAllReports(mergedReports);
        setIncidentLog(mergedIncidents);

        if (isSupabaseConfigured()) {
          const { data: apptRows } = await supabase
            .from('visitation_requests')
            .select('id, patient_id, patient_name, family_name, status, preferred_date, preferred_time, confirmed_date, confirmed_time, admin_note, created_at')
            .order('created_at', { ascending: false });
          const idSet = new Set(finalRows.map((p) => String(p.id)));
          const nameSet = new Set(finalRows.map((p) => normalizeName(p.name)));
          const filteredAppts = (apptRows || []).filter((a) => (
            (a.patient_id != null && idSet.has(String(a.patient_id)))
            || nameSet.has(normalizeName(a.patient_name))
          ));
          setAppointments(filteredAppts);
        } else {
          const localAppts = readJson('bh_visitation_requests_v1', []);
          const idSet = new Set(finalRows.map((p) => String(p.id)));
          const nameSet = new Set(finalRows.map((p) => normalizeName(p.name)));
          const filteredAppts = (Array.isArray(localAppts) ? localAppts : []).filter((a) => (
            (a.patientId != null && idSet.has(String(a.patientId)))
            || nameSet.has(normalizeName(a.patientName))
          ));
          setAppointments(filteredAppts);
        }
        setSelectedPatientId((prev) => {
          if (prev && finalRows.some((p) => String(p.id) === String(prev))) return prev;
          return finalRows[0]?.id ? String(finalRows[0].id) : '';
        });
      } catch (e) {
        // DB read fallback: keep CLM strict by matching only this CLM's assigned patients from local cache.
        try {
          const assignmentMap = readJson(STAFF_ASSIGNMENT_STORAGE_KEY, {});
          const assignedPatientIdsFromOverrides = new Set(
            Object.entries(assignmentMap || {})
              .filter(([, v]) => patientMatchesClm(v?.caseLoadManager, me))
              .map(([pid]) => String(pid))
          );
          const localPatients = readJson('bh_patients', []);
          const rows = (Array.isArray(localPatients) ? localPatients : [])
            .filter((p) => !p.discharged_at && p.status !== 'Discharged')
            .map((p) => {
              const staff = mergeStaffAssignmentFields(p.id, assignmentMap, p);
              return {
                id: String(p.id),
                name: p.name || p.full_name || 'Patient',
                concern: p.primary_concern || p.concern || '—',
                admittedAt: p.admitted_at || p.admissionDate || '',
                clinicalStatus: p.clinical_status || p.clinicalStatus || p.status || 'Admitted',
                caseLoadManager: staff.caseLoadManager,
                programStaff: staff.programStaff,
              };
            });
          const fallbackRows = rows.filter((p) => (
            patientMatchesClm(p.caseLoadManager, me)
            || assignedPatientIdsFromOverrides.has(String(p.id))
          ));
          setPatients(fallbackRows);
          setSelectedPatientId((prev) => {
            if (prev && fallbackRows.some((p) => String(p.id) === String(prev))) return prev;
            return fallbackRows[0]?.id ? String(fallbackRows[0].id) : '';
          });
          setFormError(e?.message ? `${e.message} Using local CLM assignments.` : 'Using local CLM assignments.');
        } catch {
          setPatients([]);
          setSelectedPatientId('');
          setFormError(e?.message || 'Failed to load CLM workspace data.');
        }
      } finally {
        setLoading(false);
      }
    };
    void load();
    window.addEventListener('storage', load);
    window.addEventListener(APP_DATA_REFRESH, load);
    return () => {
      window.removeEventListener('storage', load);
      window.removeEventListener(APP_DATA_REFRESH, load);
    };
  }, []);

  const selectedPatient = useMemo(
    () => patients.find((p) => String(p.id) === String(selectedPatientId)) || null,
    [patients, selectedPatientId]
  );

  const selectedReports = useMemo(() => {
    const list = allReports[String(selectedPatientId)] || [];
    return Array.isArray(list) ? list : [];
  }, [allReports, selectedPatientId]);

  const reportsThisWeek = useMemo(() => {
    const week = String(weekNumberNow());
    return Object.values(allReports || {}).reduce((sum, arr) => (
      sum + (Array.isArray(arr) ? arr.filter((r) => String(r.weekNumber || '') === week).length : 0)
    ), 0);
  }, [allReports]);

  const patientIdSet = useMemo(() => new Set(patients.map((p) => String(p.id))), [patients]);

  const openVisitationCount = useMemo(() => {
    const open = (a) => {
      const st = String(a.status || a.Status || '').trim().toLowerCase();
      return st === 'requested' || st === '' || st === 'pending';
    };
    return (appointments || []).filter(open).length;
  }, [appointments]);

  const incidentsForCaseload = useMemo(() => (
    (incidentLog || []).filter((i) => patientIdSet.has(String(i.patientId))).length
  ), [incidentLog, patientIdSet]);

  const caseloadIncidents = useMemo(
    () => (incidentLog || []).filter((i) => patientIdSet.has(String(i.patientId)))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [incidentLog, patientIdSet]
  );

  const reportsByWeekChart = useMemo(() => {
    const counts = {};
    patients.forEach((p) => {
      const arr = allReports[String(p.id)];
      if (!Array.isArray(arr)) return;
      arr.forEach((r) => {
        const w = String(r.weekNumber || '').trim();
        if (!w) return;
        counts[w] = (counts[w] || 0) + 1;
      });
    });
    const cw = weekNumberNow();
    const fromData = Object.keys(counts)
      .map(Number)
      .filter((n) => !Number.isNaN(n))
      .sort((a, b) => a - b);
    let weeks = fromData.slice(-12);
    if (weeks.length === 0) {
      const start = Math.max(1, cw - 7);
      weeks = [];
      for (let i = start; i <= cw; i += 1) weeks.push(i);
    }
    return weeks.map((w) => ({ name: `W${w}`, reports: counts[String(w)] || 0 }));
  }, [allReports, patients]);

  const appointmentStatusChart = useMemo(() => {
    const bucket = {};
    (appointments || []).forEach((a) => {
      const label = normalizeAppointmentStatus(a);
      bucket[label] = (bucket[label] || 0) + 1;
    });
    const preferredOrder = ['Requested', 'Pending', 'Confirmed', 'Declined', 'Rescheduled'];
    const base = preferredOrder.map((name) => ({ name, value: bucket[name] || 0 }));
    const extras = Object.entries(bucket)
      .filter(([name]) => !preferredOrder.includes(name))
      .map(([name, value]) => ({ name, value }));
    return [...base, ...extras];
  }, [appointments]);

  const incidentsByMonthChart = useMemo(() => {
    const map = {};
    caseloadIncidents.forEach((i) => {
      const d = new Date(i.createdAt);
      if (Number.isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = (map[key] || 0) + 1;
    });
    const keys = Object.keys(map).sort();
    return keys.slice(-8).map((k) => {
      const [, mo] = k.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const label = `${monthNames[Math.max(0, Number(mo) - 1)]} ${k.slice(0, 4)}`;
      return { name: label, incidents: map[k] };
    });
  }, [caseloadIncidents]);

  const incidentSeverityChart = useMemo(() => {
    let demotion = 0;
    let intervention = 0;
    caseloadIncidents.forEach((i) => {
      if (i.severity === 'demotion_trigger') demotion += 1;
      else intervention += 1;
    });
    return [
      { name: 'Demotion trigger', value: demotion },
      { name: 'Intervention only', value: intervention },
    ];
  }, [caseloadIncidents]);

  const reportsPerResidentChart = useMemo(() => (
    patients
      .map((p) => {
        const n = p.name || 'Resident';
        const short = n.length > 18 ? `${n.slice(0, 16)}…` : n;
        return {
          name: short,
          reports: Array.isArray(allReports[String(p.id)]) ? allReports[String(p.id)].length : 0,
        };
      })
      .sort((a, b) => b.reports - a.reports)
      .slice(0, 8)
  ), [patients, allReports]);

  const hasAnyReportsTrend = useMemo(
    () => reportsByWeekChart.some((r) => r.reports > 0),
    [reportsByWeekChart]
  );

  const allReportsFlat = useMemo(() => {
    const rows = [];
    patients.forEach((p) => {
      const arr = allReports[String(p.id)];
      if (!Array.isArray(arr)) return;
      arr.forEach((r) => {
        rows.push({
          ...r,
          patientId: String(p.id),
          patientName: p.name,
        });
      });
    });
    return rows.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
  }, [patients, allReports]);

  const saveClmReport = useCallback(async () => {
    if (!selectedPatient) return;
    const week = String(reportForm.weekNumber || '').trim();
    if (!week || !reportForm.summary.trim()) {
      setFormError('Week number and CLM summary are required.');
      return;
    }
    let report = {
      id: `clm_${Date.now()}`,
      patientId: String(selectedPatient.id),
      patientName: selectedPatient.name,
      clmName: me.fullName,
      weekNumber: week,
      socialCaseStudy: reportForm.socialCaseStudy.trim(),
      psychologicalExam: reportForm.psychologicalExam.trim(),
      behaviorObservation: reportForm.behaviorObservation.trim(),
      interventions: reportForm.interventions.trim(),
      accomplishments: reportForm.accomplishments.trim(),
      nextPlan: reportForm.nextPlan.trim(),
      summary: reportForm.summary.trim(),
      submittedAt: new Date().toISOString(),
    };

    let reportDbError = '';
    if (isSupabaseConfigured()) {
      try {
        const { data: u } = await supabase.auth.getUser();
        const uid = u?.user?.id || null;
        const payload = clmReportToInsertPayload(report, uid);
        const { data: ins, error } = await supabase
          .from('clm_weekly_reports')
          .insert(payload)
          .select('id')
          .maybeSingle();
        if (error) throw error;
        if (ins?.id) report = { ...report, id: String(ins.id) };
      } catch (e) {
        console.warn('[CLM] report insert:', e?.message || e);
        reportDbError = e?.message || 'Could not sync report to the server.';
      }
    }

    const nextAll = { ...allReports };
    const existing = Array.isArray(nextAll[String(selectedPatient.id)]) ? nextAll[String(selectedPatient.id)] : [];
    nextAll[String(selectedPatient.id)] = [report, ...existing];
    localStorage.setItem(CLM_WEEKLY_REPORTS_KEY, JSON.stringify(nextAll));
    setAllReports(nextAll);

    const consolidated = readJson(GUARDIAN_CONSOLIDATED_KEY, {});
    consolidated[String(selectedPatient.id)] = {
      ...(consolidated[String(selectedPatient.id)] || {}),
      clmReport: report.summary,
      interventions: report.interventions || (consolidated[String(selectedPatient.id)]?.interventions || ''),
      accomplishments: report.accomplishments || (consolidated[String(selectedPatient.id)]?.accomplishments || ''),
      nextPlan: report.nextPlan || (consolidated[String(selectedPatient.id)]?.nextPlan || ''),
      updatedBy: me.fullName,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(GUARDIAN_CONSOLIDATED_KEY, JSON.stringify(consolidated));

    if (reportDbError) {
      setFormError(`${reportDbError} A copy was saved in this browser.`);
      setSaveMsg(`CLM report saved on this device for ${selectedPatient.name}.`);
    } else {
      setFormError('');
      setSaveMsg(`CLM weekly report saved for ${selectedPatient.name}.`);
    }
    setReportForm({ ...EMPTY_FORM, weekNumber: String(weekNumberNow()) });
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event(APP_DATA_REFRESH));
    setTimeout(() => setSaveMsg(''), 2200);
  }, [selectedPatient, reportForm, allReports, me.fullName]);

  const saveIncident = useCallback(async () => {
    if (!selectedPatient) return;
    const behaviorType = String(incidentDraft.behaviorType || '').trim();
    const intervention = String(incidentDraft.intervention || '').trim();
    if (!behaviorType || !intervention) {
      setFormError('Behavior type and intervention are required for incident tagging.');
      return;
    }
    let item = {
      id: `inc_${Date.now()}`,
      patientId: String(selectedPatient.id),
      patientName: selectedPatient.name,
      behaviorType,
      severity: incidentDraft.severity === 'demotion_trigger' ? 'demotion_trigger' : 'intervention_only',
      intervention,
      note: String(incidentDraft.note || '').trim(),
      createdAt: new Date().toISOString(),
      clmName: me.fullName,
    };

    let incidentDbError = '';
    if (isSupabaseConfigured()) {
      try {
        const { data: u } = await supabase.auth.getUser();
        const uid = u?.user?.id || null;
        const payload = clmIncidentToInsertPayload(item, uid);
        const { data: ins, error } = await supabase
          .from('clm_incidents')
          .insert(payload)
          .select('id')
          .maybeSingle();
        if (error) throw error;
        if (ins?.id) item = { ...item, id: String(ins.id) };
      } catch (e) {
        console.warn('[CLM] incident insert:', e?.message || e);
        incidentDbError = e?.message || 'Could not sync incident to the server.';
      }
    }

    const next = [item, ...incidentLog].slice(0, 200);
    setIncidentLog(next);
    localStorage.setItem(CLM_INCIDENT_LOG_KEY, JSON.stringify(next));

    const ladderProfiles = loadLadderProfiles();
    const pid = String(selectedPatient.id);
    const prev = ladderProfiles[pid] || {};
    const currentPos = Math.max(1, Math.min(50, Number(prev.currentPosition || 1)));
    const shouldDemote = item.severity === 'demotion_trigger';
    ladderProfiles[pid] = {
      ...prev,
      currentPosition: shouldDemote ? Math.max(1, currentPos - 1) : currentPos,
      lastBehavior: item.behaviorType,
      lastIntervention: item.intervention,
      lastIncidentNote: item.note || (shouldDemote ? 'CLM demotion-trigger incident logged.' : 'CLM intervention-only incident logged.'),
      updatedAt: new Date().toISOString(),
      updatedBy: me.fullName,
    };
    saveLadderProfiles(ladderProfiles);

    setIncidentDraft({ behaviorType: '', severity: 'intervention_only', intervention: '', note: '' });
    if (incidentDbError) {
      setFormError(`${incidentDbError} A copy was saved in this browser.`);
    } else {
      setFormError('');
    }
    setSaveMsg(
      incidentDbError
        ? `Incident saved on this device for ${selectedPatient.name}. Ladder profile updated.`
        : (shouldDemote
          ? `Incident tagged and ladder profile updated (demotion applied) for ${selectedPatient.name}.`
          : `Incident tagged and ladder profile updated for ${selectedPatient.name}.`)
    );
    setTimeout(() => setSaveMsg(''), 2200);
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event(APP_DATA_REFRESH));
  }, [selectedPatient, incidentDraft, incidentLog, me.fullName]);

  const value = useMemo(() => ({
    loading,
    formError,
    setFormError,
    saveMsg,
    setSaveMsg,
    me,
    patients,
    selectedPatientId,
    setSelectedPatientId,
    selectedPatient,
    selectedReports,
    reportForm,
    setReportForm,
    allReports,
    appointments,
    incidentLog,
    incidentDraft,
    setIncidentDraft,
    reportsThisWeek,
    patientIdSet,
    openVisitationCount,
    incidentsForCaseload,
    caseloadIncidents,
    reportsByWeekChart,
    appointmentStatusChart,
    incidentsByMonthChart,
    incidentSeverityChart,
    reportsPerResidentChart,
    hasAnyReportsTrend,
    allReportsFlat,
    saveClmReport,
    saveIncident,
  }), [
    loading,
    formError,
    saveMsg,
    me,
    patients,
    selectedPatientId,
    selectedPatient,
    selectedReports,
    reportForm,
    allReports,
    appointments,
    incidentLog,
    incidentDraft,
    reportsThisWeek,
    patientIdSet,
    openVisitationCount,
    incidentsForCaseload,
    caseloadIncidents,
    reportsByWeekChart,
    appointmentStatusChart,
    incidentsByMonthChart,
    incidentSeverityChart,
    reportsPerResidentChart,
    hasAnyReportsTrend,
    allReportsFlat,
    saveClmReport,
    saveIncident,
  ]);

  return (
    <CaseLoadContext.Provider value={value}>
      {children}
    </CaseLoadContext.Provider>
  );
}
