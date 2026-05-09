import React from 'react';
import { ProgramPatientDatabase } from '@/pages/admin/patient-database';

/**
 * Program workspace — tab 1: assigned residents (case load manager match),
 * same patterns as admin Resident Management with program-specific section order.
 */
export default function ProgramPage() {
  return <ProgramPatientDatabase />;
}
