import React from 'react';
import { NursePatientDatabase } from '@/pages/admin/patient-database';

/**
 * Dedicated nurse entry file for patient management.
 * This keeps nurse routing isolated so nurse-specific behavior can
 * be adjusted without changing admin route wiring.
 */
export default function NursePatientDatabasePage() {
  return <NursePatientDatabase />;
}
