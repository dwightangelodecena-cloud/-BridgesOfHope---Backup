/** Shared nurse vs program staff lists for resident assignment dropdowns. */

export const isNurseAccountType = (account) => {
  const a = String(account || '').trim().toLowerCase();
  return a === 'nurse' || a.includes('nurse');
};

export const isProgramStaffAccountType = (account) => {
  const a = String(account || '').trim().toLowerCase();
  return (
    a === 'program'
    || a.includes('program')
    || a.includes('staff')
    || a === 'clinic'
    || a.includes('clinic')
    || a === 'case_manager'
    || a.includes('case_load')
  );
};

const toTitleCase = (value) =>
  String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

const normalizeMiddleInitial = (value) =>
  String(value || '').trim().replace(/[^A-Za-z]/g, '').slice(0, 1).toUpperCase();

const composeProfileName = (firstName, lastName, middleInitial) =>
  [toTitleCase(firstName), normalizeMiddleInitial(middleInitial), toTitleCase(lastName)]
    .filter(Boolean)
    .join(' ');

export const profileDisplayNameFromRow = (row) => {
  const composed =
    String(row?.full_name || row?.name || '').trim()
    || composeProfileName(row?.first_name, row?.last_name, row?.middle_initial);
  return composed.trim();
};

/**
 * Shared partition core: buckets profiles into nurse / program-staff candidates,
 * deduplicated by display name, each candidate carrying its profile id.
 * @returns {{ nurses: {id: string|null, name: string}[], programStaff: {id: string|null, name: string}[] }}
 * programStaff = program / case-load role; nurses = nurse role.
 */
export const partitionProfilesForStaffAssignmentWithIds = (profiles) => {
  const nurses = [];
  const programStaff = [];
  const seenN = new Set();
  const seenP = new Set();

  (profiles || []).forEach((row) => {
    const name = profileDisplayNameFromRow(row);
    if (!name) return;

    const accountNorm = String(row?.account_type || row?.role || '').trim().toLowerCase();
    if (accountNorm === 'family' || accountNorm === 'admin' || accountNorm === '') return;

    const dept = String(row?.department || row?.role_label || '').trim().toLowerCase();
    const isNurse =
      isNurseAccountType(accountNorm) || dept.includes('nurse');
    const isProgramSide =
      !isNurse
      && (
        isProgramStaffAccountType(accountNorm)
        || dept.includes('program')
        || dept.includes('case load')
      );

    const id = row?.id ?? row?.profileId ?? row?.profile_id ?? null;

    if (isNurse) {
      if (!seenN.has(name)) {
        seenN.add(name);
        nurses.push({ id, name });
      }
    } else if (isProgramSide) {
      if (!seenP.has(name)) {
        seenP.add(name);
        programStaff.push({ id, name });
      }
    }
  });

  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  nurses.sort(byName);
  programStaff.sort(byName);
  return { nurses, programStaff };
};

/**
 * @returns {{ nurses: string[], programStaff: string[] }}
 * programStaff = program / case-load role; nurses = nurse role.
 */
export const partitionProfilesForStaffAssignment = (profiles) => {
  const { nurses, programStaff } = partitionProfilesForStaffAssignmentWithIds(profiles);
  return {
    nurses: nurses.map((c) => c.name),
    programStaff: programStaff.map((c) => c.name),
  };
};

/** patients.case_load_manager — program / case-load staff (not the nurse). */
export function residentProgramStaffName(row) {
  return String(row?.case_load_manager ?? row?.caseLoadManager ?? '').trim();
}

/** patients.program_staff — assigned nurse (legacy column name). */
export function residentNurseName(row) {
  return String(row?.program_staff ?? row?.programStaff ?? '').trim();
}
