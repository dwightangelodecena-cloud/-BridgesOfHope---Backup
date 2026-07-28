import { supabase } from '@/lib/supabase';
import { validateBedPlacementPolicy } from '@/lib/residentPlacement';

export const WARD_OPTIONS = ['Female Ward', 'Male Ward'];

/** Facility-wide bed capacity — admin is warned before exceeding this across all rooms. */
export const FACILITY_TOTAL_CAPACITY = 50;

/** Every room is exactly 3 beds: one bottom, one middle, one upper bunk. Not admin-configurable. */
export const ROOM_CAPACITY = 3;
export const BUNK_LEVELS = ['Bottom', 'Middle', 'Upper'];

/** Ward a resident's gender is restricted to (both wards are always gender-restricted now). */
export function wardGenderRestriction(ward) {
  if (ward === 'Female Ward') return 'Female';
  if (ward === 'Male Ward') return 'Male';
  return '';
}

function toUiRoom(row) {
  return {
    id: row.id,
    ward: row.ward,
    roomNumber: row.room_number,
    capacity: row.capacity ?? ROOM_CAPACITY,
    isActive: row.is_active !== false,
  };
}

/**
 * Active rooms plus their current (non-discharged) occupants, each with their bunk + risk level.
 * @returns {{ ok: true, rooms: Array } | { ok: false, errorMessage: string }}
 */
export async function fetchRoomsWithOccupancy() {
  const { data: roomRows, error: roomErr } = await supabase
    .from('rooms')
    .select('*')
    .eq('is_active', true)
    .order('ward', { ascending: true })
    .order('room_number', { ascending: true });
  if (roomErr) {
    return { ok: false, errorMessage: roomErr.message || 'Could not load rooms.' };
  }

  const { data: occupantRows, error: occErr } = await supabase
    .from('patients')
    .select('id, full_name, gender, room_id, bunk_level, risk_level, discharged_at')
    .not('room_id', 'is', null);
  if (occErr) {
    return { ok: false, errorMessage: occErr.message || 'Could not load room occupants.' };
  }

  const occupantsByRoomId = new Map();
  (occupantRows || [])
    .filter((p) => !p.discharged_at)
    .forEach((p) => {
      const list = occupantsByRoomId.get(p.room_id) || [];
      list.push({
        id: p.id,
        name: p.full_name || 'Unknown Resident',
        gender: p.gender || '',
        bunkLevel: p.bunk_level || '',
        riskLevel: p.risk_level || '',
      });
      occupantsByRoomId.set(p.room_id, list);
    });

  const rooms = (roomRows || []).map((row) => ({
    ...toUiRoom(row),
    occupants: occupantsByRoomId.get(row.id) || [],
  }));

  return { ok: true, rooms };
}

/** Residents not currently discharged and not assigned to any room, with risk level (for bunk-eligibility checks). */
export async function fetchUnassignedResidents() {
  const { data, error } = await supabase
    .from('patients')
    .select('id, full_name, gender, risk_level, discharged_at, room_id')
    .is('room_id', null)
    .is('discharged_at', null)
    .order('full_name', { ascending: true });
  if (error) {
    return { ok: false, errorMessage: error.message || 'Could not load residents.' };
  }
  return {
    ok: true,
    residents: (data || []).map((p) => ({
      id: p.id,
      name: p.full_name || 'Unknown Resident',
      gender: p.gender || '',
      riskLevel: p.risk_level || '',
    })),
  };
}

/** @returns {{ ok: true, roomId: string } | { ok: false, errorMessage: string }} */
export async function createRoom({ ward, roomNumber }) {
  const { data, error } = await supabase
    .from('rooms')
    .insert({
      ward,
      room_number: String(roomNumber || '').trim(),
      capacity: ROOM_CAPACITY,
    })
    .select('id')
    .single();
  if (error) {
    return { ok: false, errorMessage: error.message || 'Could not create room.' };
  }
  return { ok: true, roomId: data.id };
}

export async function updateRoom(roomId, { ward, roomNumber }) {
  const { error } = await supabase
    .from('rooms')
    .update({
      ward,
      room_number: String(roomNumber || '').trim(),
      capacity: ROOM_CAPACITY,
      updated_at: new Date().toISOString(),
    })
    .eq('id', roomId);
  if (error) {
    return { ok: false, errorMessage: error.message || 'Could not update room.' };
  }
  return { ok: true };
}

/** Refuses to delete a room that still has residents assigned. */
export async function deleteRoom(roomId, occupantCount) {
  if (occupantCount > 0) {
    return { ok: false, errorMessage: 'Unassign all residents from this room before deleting it.' };
  }
  const { error } = await supabase.from('rooms').delete().eq('id', roomId);
  if (error) {
    return { ok: false, errorMessage: error.message || 'Could not delete room.' };
  }
  return { ok: true };
}

/**
 * Link a resident to a room without touching bunk_level — used by the Resident Management page,
 * which validates policy and saves bunk_level itself via persistResidentPlacement().
 */
export async function assignPatientToRoom(patientId, room) {
  const { error } = await supabase
    .from('patients')
    .update({ room_id: room.id, room_code: room.roomNumber })
    .eq('id', patientId);
  if (error) {
    return { ok: false, errorMessage: error.message || 'Could not assign resident to room.' };
  }
  return { ok: true };
}

/**
 * Assign a resident to a specific bunk in a room. Enforces the same safety policy as the
 * Resident Management page: a "Highly Suicidal" resident cannot be placed on the upper bunk.
 * @returns {{ ok: true } | { ok: false, errorMessage: string }}
 */
export async function assignPatientToBunk(patientId, room, bunkLevel, riskLevel) {
  const policyError = validateBedPlacementPolicy({
    genderSegment: wardGenderRestriction(room.ward),
    riskLevel,
    bunkLevel,
  });
  if (policyError) {
    return { ok: false, errorMessage: policyError };
  }
  const { error } = await supabase
    .from('patients')
    .update({ room_id: room.id, room_code: room.roomNumber, bunk_level: bunkLevel })
    .eq('id', patientId);
  if (error) {
    return { ok: false, errorMessage: error.message || 'Could not assign resident to bed.' };
  }
  return { ok: true };
}

export async function unassignPatientFromRoom(patientId) {
  const { error } = await supabase
    .from('patients')
    .update({ room_id: null, room_code: null, bunk_level: null })
    .eq('id', patientId);
  if (error) {
    return { ok: false, errorMessage: error.message || 'Could not unassign resident from room.' };
  }
  return { ok: true };
}
