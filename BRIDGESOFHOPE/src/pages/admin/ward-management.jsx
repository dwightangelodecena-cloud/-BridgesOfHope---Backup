import React, { useCallback, useEffect, useState } from 'react';
import {
  BedDouble,
  Plus,
  Pencil,
  Trash2,
  X,
  RefreshCw,
} from 'lucide-react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { familySidebarStyle } from '@/lib/familySidebarStyle';
import { APP_DATA_REFRESH } from '@/lib/appDataRefresh';
import {
  WARD_OPTIONS,
  FACILITY_TOTAL_CAPACITY,
  ROOM_CAPACITY,
  BUNK_LEVELS,
  wardGenderRestriction,
  fetchRoomsWithOccupancy,
  fetchUnassignedResidents,
  createRoom,
  updateRoom,
  deleteRoom,
  assignPatientToBunk,
  unassignPatientFromRoom,
} from '@/lib/roomAssignment';

const emptyRoomForm = (ward) => ({ ward, roomNumber: '' });

function roomFormFromRoom(room) {
  return { ward: room.ward, roomNumber: room.roomNumber };
}

const emptyBunkSelection = () => ({ Bottom: '', Upper: '' });

export default function WardManagement() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [unassignedResidents, setUnassignedResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeWard, setActiveWard] = useState(WARD_OPTIONS[1] || WARD_OPTIONS[0]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [bunkSelection, setBunkSelection] = useState(emptyBunkSelection);
  const [busy, setBusy] = useState(false);

  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [roomForm, setRoomForm] = useState(emptyRoomForm(activeWard));
  const [roomFormError, setRoomFormError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const [roomsRes, residentsRes] = await Promise.all([
        fetchRoomsWithOccupancy(),
        fetchUnassignedResidents(),
      ]);
      if (!roomsRes.ok) {
        setErrorMessage(roomsRes.errorMessage);
        setRooms([]);
      } else {
        setRooms(roomsRes.rooms);
      }
      if (residentsRes.ok) {
        setUnassignedResidents(residentsRes.residents);
      }
    } catch (e) {
      console.error(e);
      setErrorMessage(e.message || 'Failed to load rooms.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    const onRefresh = () => {
      void loadData();
    };
    window.addEventListener(APP_DATA_REFRESH, onRefresh);
    return () => {
      window.removeEventListener(APP_DATA_REFRESH, onRefresh);
    };
  }, [loadData]);

  const roomsForWard = rooms.filter((r) => r.ward === activeWard);
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) || null;

  const selectRoom = (roomId) => {
    setSelectedRoomId(roomId);
    setBunkSelection(emptyBunkSelection());
  };

  const genderRestriction = selectedRoom ? wardGenderRestriction(selectedRoom.ward) : '';
  const assignableResidents = genderRestriction
    ? unassignedResidents.filter((p) => !p.gender || p.gender === genderRestriction)
    : unassignedResidents;

  const openAddRoomModal = () => {
    setEditingRoomId(null);
    setRoomForm(emptyRoomForm(activeWard));
    setRoomFormError('');
    setRoomModalOpen(true);
  };

  const openEditRoomModal = (room) => {
    setEditingRoomId(room.id);
    setRoomForm(roomFormFromRoom(room));
    setRoomFormError('');
    setRoomModalOpen(true);
  };

  /** Total capacity across all active rooms, excluding the room currently being edited (each room is fixed at ROOM_CAPACITY beds). */
  const totalCapacityExcluding = (excludeRoomId) =>
    rooms.filter((r) => r.id !== excludeRoomId).reduce((sum, r) => sum + r.capacity, 0);

  const handleSaveRoom = async () => {
    if (!roomForm.roomNumber.trim()) {
      setRoomFormError('Room number is required.');
      return;
    }
    // Editing never changes a room's capacity (fixed at ROOM_CAPACITY), so the facility-wide
    // limit only needs checking when adding a brand new room.
    if (!editingRoomId) {
      const projectedTotal = totalCapacityExcluding(null) + ROOM_CAPACITY;
      if (projectedTotal > FACILITY_TOTAL_CAPACITY) {
        setRoomFormError(
          `This would bring total facility capacity to ${projectedTotal}, over the ${FACILITY_TOTAL_CAPACITY}-bed limit.`
        );
        return;
      }
    }
    setBusy(true);
    setRoomFormError('');
    const res = editingRoomId
      ? await updateRoom(editingRoomId, roomForm)
      : await createRoom(roomForm);
    setBusy(false);
    if (!res.ok) {
      setRoomFormError(res.errorMessage);
      return;
    }
    setRoomModalOpen(false);
    await loadData();
    // After creating a room, jump straight into assigning residents to it.
    if (!editingRoomId && res.roomId) {
      selectRoom(res.roomId);
    }
  };

  const handleDeleteRoom = async (room) => {
    if (!window.confirm(`Delete ${room.roomNumber}? This cannot be undone.`)) return;
    setBusy(true);
    const res = await deleteRoom(room.id, room.occupants.length);
    setBusy(false);
    if (!res.ok) {
      setErrorMessage(res.errorMessage);
      return;
    }
    if (selectedRoomId === room.id) selectRoom(null);
    await loadData();
  };

  const handleAssignBunk = async (bunk) => {
    const residentId = bunkSelection[bunk];
    if (!selectedRoom || !residentId) return;
    const resident = assignableResidents.find((p) => p.id === residentId);
    setBusy(true);
    setErrorMessage('');
    const res = await assignPatientToBunk(residentId, selectedRoom, bunk, resident?.riskLevel);
    setBusy(false);
    if (!res.ok) {
      setErrorMessage(res.errorMessage);
      return;
    }
    setBunkSelection((prev) => ({ ...prev, [bunk]: '' }));
    await loadData();
  };

  const handleUnassign = async (patientId) => {
    setBusy(true);
    setErrorMessage('');
    const res = await unassignPatientFromRoom(patientId);
    setBusy(false);
    if (!res.ok) {
      setErrorMessage(res.errorMessage);
      return;
    }
    await loadData();
  };

  return (
    <div
      className="family-portal admin-portal-layout wm-outer"
      style={{ display: 'flex', minHeight: '100vh', background: '#F8F9FD', fontFamily: "'Inter', sans-serif", color: '#1B2559', ...familySidebarStyle(isExpanded) }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        .wm-outer { width: 100%; overflow-x: clip; }
        .wm-main { flex: 0 0 auto; min-height: 100vh; padding: 24px; }
        .wm-card { background: white; border: 1px solid #E9EDF7; border-radius: 20px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.02); }
        .wm-tabs { display: flex; gap: 6px; border-bottom: 1px solid #E9EDF7; margin-bottom: 20px; flex-wrap: wrap; }
        .wm-tab { border: none; background: none; padding: 12px 18px; font-size: 13px; font-weight: 700; color: #A3AED0; cursor: pointer; border-bottom: 3px solid transparent; }
        .wm-tab--active { color: #1B2559; border-bottom-color: #F54E25; }
        .wm-layout { display: grid; grid-template-columns: 1fr 320px; gap: 20px; align-items: start; }
        @media (max-width: 900px) { .wm-layout { grid-template-columns: 1fr; } }
        .wm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 18px; }
        .wm-bed-btn { display: flex; flex-direction: column; align-items: center; gap: 6px; background: none; border: none; cursor: pointer; padding: 8px 4px; border-radius: 12px; }
        .wm-bed-btn:hover { background: #F8FAFC; }
        .wm-bed-btn--selected { background: #EEF2FF; }
        .wm-bed-label { font-size: 12px; font-weight: 700; color: #475569; }
        .wm-panel-label { color: #A3AED0; font-size: 12px; font-weight: 600; margin-bottom: 6px; }
        .wm-panel-value { font-size: 16px; font-weight: 800; color: #0F172A; }
        .wm-input { width: 100%; border: 1px solid #E9EDF7; border-radius: 10px; padding: 10px 12px; font-size: 13px; color: #1B2559; outline: none; background: white; }
        .wm-input:focus { border-color: #2563EB; }
        .wm-modal-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,0.35); display: flex; align-items: center; justify-content: center; z-index: 1100; padding: 16px; }
        .wm-modal { width: min(92vw, 480px); max-height: 90vh; overflow-y: auto; background: white; border-radius: 20px; box-shadow: 0 20px 50px rgba(15,23,42,0.25); }
        .wm-modal-head { padding: 16px 20px; border-bottom: 1px solid #EEF2FF; display: flex; align-items: center; justify-content: space-between; }
        .wm-modal-body { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
        .wm-field-label { font-size: 12px; font-weight: 700; color: #707EAE; margin-bottom: 6px; display: block; }
        .wm-bunk-row { border: 1px solid #F1F5F9; border-radius: 12px; padding: 10px 12px; margin-bottom: 10px; }
        .wm-bunk-title { font-size: 12px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 8px; }
        .wm-occupant-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 13px; }
        .wm-bunk-assign-row { display: flex; gap: 6px; }
        .wm-bunk-hint { font-size: 11px; color: #B91C1C; font-weight: 600; margin-top: 6px; }
        .wm-btn { border: none; border-radius: 8px; padding: 8px 14px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: 'Inter', sans-serif; }
        .wm-btn--primary { background: #F54E25; color: white; }
        .wm-btn--outline { background: white; color: #0F766E; border: 2px solid #0F766E; }
        .wm-btn--danger { background: #FEE2E2; color: #B91C1C; }
        .wm-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        @media (max-width: 768px) { .desktop-sidebar { display: none !important; } .wm-main { padding: 20px 12px 100px 12px !important; } }
      `}</style>

      <AdminSidebar isExpanded={isExpanded} onToggleExpanded={() => setIsExpanded(!isExpanded)} />

      <main className="wm-main admin-sidebar-offset">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0F172A' }}>Ward &amp; Room Management</h1>
            <p style={{ fontSize: 13, color: '#707EAE', marginTop: 8, fontWeight: 500 }}>
              Every room has 2 beds (bottom, upper bunk). Facility capacity: {totalCapacityExcluding(null)} / {FACILITY_TOTAL_CAPACITY} beds across all rooms.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="wm-btn wm-btn--outline" type="button" onClick={() => void loadData()} disabled={loading}>
              <RefreshCw size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button className="wm-btn wm-btn--primary" type="button" onClick={openAddRoomModal}>
              <Plus size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
              Add room
            </button>
          </div>
        </div>

        {errorMessage ? (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 12, padding: '10px 14px', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
            {errorMessage}
          </div>
        ) : null}

        <div className="wm-card">
          <div className="wm-tabs">
            {WARD_OPTIONS.map((ward) => (
              <button
                key={ward}
                type="button"
                className={`wm-tab${ward === activeWard ? ' wm-tab--active' : ''}`}
                onClick={() => setActiveWard(ward)}
              >
                {ward.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="wm-layout">
            <div>
              {loading ? (
                <p style={{ color: '#A3AED0', fontSize: 13 }}>Loading rooms...</p>
              ) : roomsForWard.length === 0 ? (
                <p style={{ color: '#A3AED0', fontSize: 13 }}>No rooms in {activeWard} yet. Add one to get started.</p>
              ) : (
                <div className="wm-grid">
                  {roomsForWard.map((room) => {
                    const full = room.occupants.length >= room.capacity;
                    const occupied = room.occupants.length > 0;
                    const color = full ? '#EF4444' : occupied ? '#F59E0B' : '#94A3B8';
                    return (
                      <button
                        key={room.id}
                        type="button"
                        className={`wm-bed-btn${room.id === selectedRoomId ? ' wm-bed-btn--selected' : ''}`}
                        onClick={() => selectRoom(room.id)}
                        title={`${room.roomNumber} — ${room.occupants.length}/${room.capacity} occupied`}
                      >
                        <BedDouble size={34} color={color} strokeWidth={2} fill={occupied ? color : 'none'} />
                        <span className="wm-bed-label">{room.roomNumber}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="wm-card" style={{ padding: 18, border: '1px solid #F1F5F9' }}>
              {!selectedRoom ? (
                <p style={{ color: '#A3AED0', fontSize: 13 }}>Select a bed to view details and assign residents.</p>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <p className="wm-panel-value">{selectedRoom.roomNumber}</p>
                      <p style={{ fontSize: 12, color: '#707EAE', fontWeight: 600 }}>{selectedRoom.ward} · {selectedRoom.occupants.length}/{selectedRoom.capacity} beds filled</p>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" className="wm-btn wm-btn--outline" style={{ padding: 6 }} onClick={() => openEditRoomModal(selectedRoom)} aria-label="Edit room">
                        <Pencil size={14} />
                      </button>
                      <button type="button" className="wm-btn wm-btn--danger" style={{ padding: 6 }} onClick={() => handleDeleteRoom(selectedRoom)} aria-label="Delete room">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {BUNK_LEVELS.map((bunk) => {
                    const occupant = selectedRoom.occupants.find((o) => o.bunkLevel === bunk);
                    const eligibleResidents = bunk === 'Upper'
                      ? assignableResidents.filter((p) => p.riskLevel !== 'Highly Suicidal')
                      : assignableResidents;
                    const blockedCount = bunk === 'Upper'
                      ? assignableResidents.length - eligibleResidents.length
                      : 0;
                    return (
                      <div key={bunk} className="wm-bunk-row">
                        <p className="wm-bunk-title">{bunk} bunk</p>
                        {occupant ? (
                          <div className="wm-occupant-row">
                            <span>{occupant.name}</span>
                            <button type="button" className="wm-btn wm-btn--danger" disabled={busy} onClick={() => handleUnassign(occupant.id)}>
                              Remove
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="wm-bunk-assign-row">
                              <select
                                className="wm-input"
                                value={bunkSelection[bunk]}
                                onChange={(e) => setBunkSelection((prev) => ({ ...prev, [bunk]: e.target.value }))}
                              >
                                <option value="">Select resident...</option>
                                {eligibleResidents.map((p) => (
                                  <option key={p.id} value={p.id}>{p.name}{p.gender ? ` (${p.gender})` : ''}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="wm-btn wm-btn--primary"
                                disabled={busy || !bunkSelection[bunk]}
                                onClick={() => handleAssignBunk(bunk)}
                              >
                                Assign
                              </button>
                            </div>
                            {bunk === 'Upper' && blockedCount > 0 ? (
                              <p className="wm-bunk-hint">{blockedCount} highly suicidal resident{blockedCount === 1 ? '' : 's'} hidden — not eligible for upper bunk.</p>
                            ) : null}
                          </>
                        )}
                      </div>
                    );
                  })}

                  {selectedRoom.occupants.filter((o) => !BUNK_LEVELS.includes(o.bunkLevel)).map((o) => (
                    <div key={o.id} className="wm-bunk-row" style={{ borderColor: '#FCA5A5' }}>
                      <p className="wm-bunk-title" style={{ color: '#B91C1C' }}>Needs bunk assignment</p>
                      <div className="wm-occupant-row">
                        <span>{o.name}</span>
                        <button type="button" className="wm-btn wm-btn--danger" disabled={busy} onClick={() => handleUnassign(o.id)}>
                          Remove
                        </button>
                      </div>
                      <p className="wm-bunk-hint">Counted in this room but has no bottom/upper bunk on file — remove and re-assign to fix.</p>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {roomModalOpen ? (
        <div className="wm-modal-backdrop" onClick={() => !busy && setRoomModalOpen(false)}>
          <div className="wm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wm-modal-head">
              <span style={{ fontSize: 16, fontWeight: 800 }}>{editingRoomId ? 'Edit room' : 'Add room'}</span>
              <button type="button" className="wm-btn wm-btn--outline" style={{ padding: 6 }} onClick={() => setRoomModalOpen(false)} aria-label="Close">
                <X size={14} />
              </button>
            </div>
            <div className="wm-modal-body">
              <div>
                <span className="wm-field-label">Ward</span>
                <select className="wm-input" value={roomForm.ward} onChange={(e) => setRoomForm((p) => ({ ...p, ward: e.target.value }))}>
                  {WARD_OPTIONS.map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="wm-field-label">Room / bed number</span>
                <input
                  className="wm-input"
                  value={roomForm.roomNumber}
                  onChange={(e) => setRoomForm((p) => ({ ...p, roomNumber: e.target.value }))}
                  placeholder="e.g. F203A"
                />
              </div>
              <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>
                Every room holds exactly {ROOM_CAPACITY} residents: one bottom, one upper bunk.
              </p>
              {roomFormError ? (
                <p style={{ color: '#B91C1C', fontSize: 12, fontWeight: 700 }}>{roomFormError}</p>
              ) : null}
              <button type="button" className="wm-btn wm-btn--primary" disabled={busy} onClick={handleSaveRoom}>
                {busy ? 'Saving...' : editingRoomId ? 'Save changes' : 'Create room'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
