import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { temporaryLeaveLabel } from '../../lib/dischargeRequestTypesMobile';
import { temporaryLeaveNoteLines } from '../../lib/temporaryLeaveDisplayMobile';

type PatientLike = {
  temporaryLeaveType?: string | null;
  temporary_leave_type?: string | null;
};

export function TemporaryDischargeCardBanner({
  patient,
  variant = 'default',
  requestFields = null,
}: {
  patient?: PatientLike | null;
  variant?: 'default' | 'section' | 'hero';
  requestFields?: Record<string, unknown> | null;
}) {
  const leave = temporaryLeaveLabel(patient?.temporaryLeaveType ?? patient?.temporary_leave_type);
  const { dayLabel } = temporaryLeaveNoteLines(
    patient as Record<string, unknown>,
    requestFields
  );
  const isHero = variant === 'hero';
  const metaLine = [leave, dayLabel].filter(Boolean).join(' · ');

  return (
    <View
      style={[
        styles.banner,
        variant === 'section' && styles.bannerSection,
        isHero && styles.bannerHero,
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Temporarily discharged${metaLine ? `, ${metaLine}` : ''}`}
    >
      <Text style={[styles.bannerTitle, isHero && styles.bannerTitleHero]}>
        TEMPORARILY DISCHARGED
      </Text>
      {metaLine ? (
        <Text style={[styles.bannerMeta, isHero && styles.bannerMetaHero]}>{metaLine}</Text>
      ) : null}
    </View>
  );
}

export function TemporaryDischargeNotePanel({
  patient,
  requestFields = null,
}: {
  patient?: Record<string, unknown> | null;
  requestFields?: Record<string, unknown> | null;
}) {
  const { programNote, familyReason, otherInfo, expectedReturn, dayLabel, leaveLabel } =
    temporaryLeaveNoteLines(patient, requestFields);
  const hasContent = programNote || familyReason || otherInfo || expectedReturn;
  if (!hasContent && !dayLabel) return null;

  return (
    <View style={styles.notePanel} accessibilityRole="summary">
      <View style={styles.notePanelHead}>
        <View style={styles.noteIconWrap}>
          <Ionicons name="document-text" size={16} color="#B45309" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.notePanelTitle}>Temporary discharge note</Text>
          <Text style={styles.notePanelMeta}>{[leaveLabel, dayLabel].filter(Boolean).join(' · ')}</Text>
        </View>
      </View>
      {programNote ? (
        <View style={styles.noteBlock}>
          <Text style={styles.noteLabel}>Program note</Text>
          <Text style={styles.noteBody}>{programNote}</Text>
        </View>
      ) : null}
      {familyReason ? (
        <View style={styles.noteBlock}>
          <Text style={styles.noteLabel}>Family request reason</Text>
          <Text style={styles.noteBody}>{familyReason}</Text>
        </View>
      ) : null}
      {otherInfo ? (
        <View style={styles.noteBlock}>
          <Text style={styles.noteLabel}>Additional details</Text>
          <Text style={styles.noteBody}>{otherInfo}</Text>
        </View>
      ) : null}
      {expectedReturn ? (
        <Text style={styles.noteReturn}>
          Expected return: {String(expectedReturn).slice(0, 10)}
        </Text>
      ) : null}
      {!programNote && !familyReason && !otherInfo ? (
        <Text style={styles.noteEmpty}>No written note was recorded for this temporary discharge.</Text>
      ) : null}
    </View>
  );
}

export function ResidentReturnedHeaderButton({
  busy,
  onPress,
}: {
  busy?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.returnBtn, busy && styles.returnBtnBusy]}
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Resident returned"
    >
      {busy ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Text style={styles.returnBtnTxt}>Resident returned</Text>
      )}
    </TouchableOpacity>
  );
}

export function ResidentReturnedConfirmModal({
  open,
  residentName = 'this resident',
  busy = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  residentName?: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={busy ? undefined : onClose}>
      <Pressable style={styles.modalBackdrop} onPress={busy ? undefined : onClose}>
        <Pressable style={styles.modalPanel} onPress={(e) => e.stopPropagation()}>
          <TouchableOpacity
            style={styles.modalClose}
            onPress={onClose}
            disabled={busy}
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={20} color="#64748B" />
          </TouchableOpacity>
          <View style={styles.modalIconWrap}>
            <Ionicons name="checkmark-circle" size={28} color="#059669" />
          </View>
          <Text style={styles.modalTitle}>Mark as returned?</Text>
          <Text style={styles.modalBody}>
            Mark <Text style={styles.modalBodyStrong}>{residentName}</Text> as returned? They will no
            longer be on temporary discharge and will show as active in care.
          </Text>
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancel} onPress={onClose} disabled={busy}>
              <Text style={styles.modalCancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalConfirm} onPress={onConfirm} disabled={busy}>
              {busy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.modalConfirmTxt}>Confirm return</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderRadius: 12,
  },
  bannerSection: {
    marginBottom: 0,
    borderRadius: 0,
    borderTopLeftRadius: 13,
    borderTopRightRadius: 13,
    paddingVertical: 12,
  },
  bannerHero: {
    marginBottom: 10,
    marginTop: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(254,243,199,0.95)',
  },
  bannerTitle: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    lineHeight: 16,
  },
  bannerTitleHero: {
    fontSize: 10,
    color: '#78350F',
  },
  bannerMeta: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
    color: '#78350F',
    lineHeight: 16,
    flexWrap: 'wrap',
  },
  bannerMetaHero: {
    color: '#92400E',
  },
  bannerSub: {
    textTransform: 'none',
    fontWeight: '600',
    color: '#78350F',
  },
  bannerSubHero: {
    color: '#92400E',
  },
  notePanel: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  notePanelHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  noteIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notePanelTitle: { fontSize: 13, fontWeight: '800', color: '#92400E' },
  notePanelMeta: { fontSize: 11, color: '#B45309', marginTop: 2 },
  noteBlock: { marginBottom: 10 },
  noteLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#A16207',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  noteBody: { fontSize: 13, color: '#78350F', lineHeight: 20 },
  noteReturn: { fontSize: 12, fontWeight: '700', color: '#92400E' },
  noteEmpty: { fontSize: 12, color: '#B45309' },
  returnBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  returnBtnBusy: {
    opacity: 0.85,
  },
  returnBtnTxt: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalPanel: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 6,
    zIndex: 1,
  },
  modalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1B2559',
    marginBottom: 8,
  },
  modalBody: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalBodyStrong: {
    fontWeight: '700',
    color: '#334155',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  modalCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  modalCancelTxt: {
    fontWeight: '700',
    color: '#475569',
    fontSize: 13,
  },
  modalConfirm: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#10B981',
    minWidth: 120,
    alignItems: 'center',
  },
  modalConfirmTxt: {
    fontWeight: '800',
    color: '#fff',
    fontSize: 13,
  },
});
