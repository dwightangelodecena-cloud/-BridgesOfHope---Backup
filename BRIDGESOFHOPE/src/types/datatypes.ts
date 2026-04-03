/** Matches Supabase `public.profiles` */

export type AccountType = "family" | "nurse" | "admin";

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  account_type: AccountType;
  province: string | null;
  municipality: string | null;
  street: string | null;
  house_block_lot: string | null;
  created_at: string;
  updated_at: string;
}

/** Matches Supabase `public.patients` */

export type ClinicalStatus = "Improving" | "Stable" | "Declining";

export interface Patient {
  id: string;
  full_name: string;
  date_of_birth: string | null;
  primary_concern: string | null;
  clinical_status: ClinicalStatus;
  progress_percent: number;
  admitted_at: string;
  discharged_at: string | null;
  family_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Matches Supabase `public.admission_requests` & `discharge_requests` */

export type RequestStatus = "pending" | "approved" | "declined";

export interface AdmissionRequest {
  id: string;
  family_id: string;
  guardian_full_name: string;
  guardian_email: string;
  guardian_phone: string;
  patient_name: string;
  patient_birth_date: string;
  reason_for_admission: string;
  status: RequestStatus;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
}

export interface DischargeRequest {
  id: string;
  patient_id: string;
  family_id: string;
  status: RequestStatus;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
}

/** Matches Supabase `public.activity_log` */

export interface ActivityLogRow {
  id: string;
  actor_id: string | null;
  title: string;
  description: string | null;
  icon_name: string | null;
  created_at: string;
}
