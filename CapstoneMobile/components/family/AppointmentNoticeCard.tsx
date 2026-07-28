import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AppointmentNotice } from '../../lib/appointmentNoticesMobile';

function formatNoticeDateTime(date: string, time: string): string {
  if (!date) return '';
  const d = new Date(`${date}T12:00:00`);
  const dateStr = Number.isNaN(d.getTime())
    ? date
    : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  if (!time) return dateStr;
  const [hh, mm] = time.split(':').map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return dateStr;
  const period = hh >= 12 ? 'PM' : 'AM';
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${dateStr} · ${hour12}:${String(mm).padStart(2, '0')} ${period}`;
}

type Props = {
  notice: AppointmentNotice;
  busy?: boolean;
  onConfirm?: () => void;
  onReject?: () => void;
  onProposeDifferent?: () => void;
  onConfirmReceived?: () => void;
};

export function AppointmentNoticeCard({ notice, busy, onConfirm, onReject, onProposeDifferent, onConfirmReceived }: Props) {
  if (notice.kind === 'pickup_received') {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={[styles.iconWrap, { backgroundColor: '#DCFCE7' }]}>
            <Ionicons name="checkmark-done" size={18} color="#16A34A" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title}>Confirm pickup</Text>
            <Text style={styles.subtitle}>Have you picked up {notice.patientName}?</Text>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [styles.confirmBtn, pressed && styles.btnPressed, busy && styles.btnDisabled]}
          onPress={onConfirmReceived}
          disabled={busy}
        >
          {busy ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.confirmBtnTxt}>Yes, I&apos;ve picked them up</Text>}
        </Pressable>
      </View>
    );
  }

  const isAdmission = notice.type === 'admission';
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, { backgroundColor: isAdmission ? '#E0E7FF' : '#FFE4D6' }]}>
          <Ionicons name="calendar" size={18} color={isAdmission ? '#4F46E5' : '#F0851F'} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title}>{isAdmission ? 'Admission Meeting' : 'Discharge Pickup'}</Text>
          <Text style={styles.subtitle}>For {notice.patientName}</Text>
        </View>
      </View>
      <View style={styles.dateBox}>
        <Ionicons name="time-outline" size={16} color="#475569" />
        <Text style={styles.dateTxt}>{formatNoticeDateTime(notice.date, notice.time)}</Text>
      </View>
      <View style={styles.actionsRow}>
        <Pressable
          style={({ pressed }) => [styles.confirmBtn, { flex: 1 }, pressed && styles.btnPressed, busy && styles.btnDisabled]}
          onPress={onConfirm}
          disabled={busy}
        >
          {busy ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.confirmBtnTxt}>Confirm</Text>}
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.rejectBtn, { flex: 1 }, pressed && styles.btnPressed, busy && styles.btnDisabled]}
          onPress={onReject}
          disabled={busy}
        >
          <Text style={styles.rejectBtnTxt}>Reject</Text>
        </Pressable>
      </View>
      {isAdmission ? (
        <Pressable onPress={onProposeDifferent} disabled={busy} hitSlop={8}>
          <Text style={styles.linkTxt}>Suggest a different time instead</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(233, 237, 247, 0.9)',
    padding: 16,
    marginBottom: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  iconWrap: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { fontSize: 14.5, fontWeight: '800', color: '#1B2559' },
  subtitle: { fontSize: 12.5, color: '#64748B', fontWeight: '600', marginTop: 2 },
  dateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  dateTxt: { fontSize: 13.5, fontWeight: '700', color: '#1B2559' },
  actionsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  confirmBtn: {
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  confirmBtnTxt: { color: '#FFFFFF', fontWeight: '800', fontSize: 13.5 },
  rejectBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  rejectBtnTxt: { color: '#991B1B', fontWeight: '800', fontSize: 13.5 },
  linkTxt: { fontSize: 12.5, fontWeight: '700', color: '#4F46E5', textAlign: 'center', marginTop: 2 },
  btnPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  btnDisabled: { opacity: 0.7 },
});
