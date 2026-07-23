import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable, ActivityIndicator, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { TAB_ROUTES } from '../../lib/navigationConfig';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { PlatformDateTimeField } from '../../components/family/PlatformDateTimeField';
import {
  fetchAdmissionRequestById,
  fetchLatestAdmissionRequest,
  canProposeMeeting,
  isAwaitingFamilyMeetingResponse,
  submitMeetingProposal,
  acceptSuggestedMeetingTime,
  type AdmissionMeetingRow,
} from '../../lib/admissionMeetingRequestMobile';

const C = {
  orange: '#F54E25',
  navy: '#1A2B4A',
  muted: '#64748B',
  border: '#E2E8F0',
};

export default function AdmissionMeetingRequest() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { requestId } = useLocalSearchParams<{ requestId?: string }>();
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<AdmissionMeetingRow | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    // Prefer the specific request the guardian navigated here for (avoids showing a
    // different patient's meeting details when a family has more than one admission request).
    let resolved: AdmissionMeetingRow | null = null;
    if (requestId) {
      resolved = await fetchAdmissionRequestById(String(requestId));
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id) resolved = await fetchLatestAdmissionRequest(user.id);
    }
    setRow(resolved);
    if (resolved) {
      setDate(resolved.preferredMeetingDate || '');
      setTime(resolved.preferredMeetingTime || '09:00');
      setNote(resolved.preferredMeetingNote || '');
    }
    setLoading(false);
  }, [requestId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleSubmitProposal = async () => {
    if (!row || !date || !time) {
      Alert.alert('Missing info', 'Please choose a date and time.');
      return;
    }
    setSaving(true);
    const res = await submitMeetingProposal(row.id, { date, time, note });
    setSaving(false);
    if (!res.ok) {
      Alert.alert('Could not send', res.errorMessage);
      return;
    }
    Alert.alert('Sent', 'Your preferred meeting time has been sent to Bridges of Hope.');
    await load();
  };

  const handleAccept = async () => {
    if (!row) return;
    setSaving(true);
    const res = await acceptSuggestedMeetingTime(row.id);
    setSaving(false);
    if (!res.ok) {
      Alert.alert('Could not confirm', res.errorMessage);
      return;
    }
    await load();
    Alert.alert('Schedule accepted', `You've confirmed the meeting time for ${row.patientName}.`);
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.navigate(TAB_ROUTES.home as never));

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.headerBack} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meeting Request</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
        {loading ? (
          <ActivityIndicator color={C.orange} style={{ marginTop: 40 }} />
        ) : !row ? (
          <View style={styles.panel}>
            <Text style={styles.emptyTitle}>No admission request found</Text>
            <Text style={styles.emptyBody}>Submit an admission request first, then come back here to request a meeting time.</Text>
            <Pressable style={styles.primaryBtn} onPress={() => router.navigate(TAB_ROUTES.admission as never)}>
              <Text style={styles.primaryBtnTxt}>Go to Admission Form</Text>
            </Pressable>
          </View>
        ) : isAwaitingFamilyMeetingResponse(row) ? (
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Bridges of Hope suggested a time</Text>
            <Text style={styles.body}>
              Your requested time wasn&apos;t available for <Text style={styles.bold}>{row.patientName}</Text>&apos;s admission meeting. Please review the suggested time below.
            </Text>
            <View style={styles.suggestedBox}>
              <Ionicons name="calendar" size={18} color={C.orange} />
              <Text style={styles.suggestedTxt}>
                {row.meetingDate}{row.meetingTime ? ` at ${row.meetingTime}` : ''}
              </Text>
            </View>
            <Pressable style={[styles.primaryBtn, saving && styles.btnDisabled]} onPress={() => void handleAccept()} disabled={saving}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnTxt}>Accept this time</Text>}
            </Pressable>
            <Text style={styles.orDivider}>or propose a different time</Text>
            <PlatformDateTimeField label="Preferred date" mode="date" value={date} minimumDate={new Date()} onChange={setDate} />
            <PlatformDateTimeField label="Preferred time" mode="time" value={time} onChange={setTime} />
            <TextInput
              style={styles.noteInput}
              placeholder="Note for the facility (optional)"
              placeholderTextColor="#94A3B8"
              value={note}
              onChangeText={setNote}
              multiline
            />
            <Pressable style={[styles.secondaryBtn, saving && styles.btnDisabled]} onPress={() => void handleSubmitProposal()} disabled={saving}>
              <Text style={styles.secondaryBtnTxt}>Propose this time instead</Text>
            </Pressable>
          </View>
        ) : canProposeMeeting(row) ? (
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>
              {row.preferredMeetingDate ? 'Waiting on Bridges of Hope' : 'Request a meeting time'}
            </Text>
            <Text style={styles.body}>
              {row.preferredMeetingDate
                ? `We're reviewing your requested time for ${row.patientName}'s admission meeting. You can still change it below before we respond.`
                : `Let us know when you'd like to meet with Bridges of Hope regarding ${row.patientName}'s admission.`}
            </Text>
            <PlatformDateTimeField label="Preferred date" mode="date" value={date} minimumDate={new Date()} onChange={setDate} />
            <PlatformDateTimeField label="Preferred time" mode="time" value={time} onChange={setTime} />
            <TextInput
              style={styles.noteInput}
              placeholder="Note for the facility (optional)"
              placeholderTextColor="#94A3B8"
              value={note}
              onChangeText={setNote}
              multiline
            />
            <Pressable style={[styles.primaryBtn, saving && styles.btnDisabled]} onPress={() => void handleSubmitProposal()} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnTxt}>{row.preferredMeetingDate ? 'Update request' : 'Send request'}</Text>
              )}
            </Pressable>
          </View>
        ) : row.meetingDate && row.meetingConfirmedByFamily ? (
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Meeting confirmed</Text>
            <View style={styles.suggestedBox}>
              <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
              <Text style={styles.suggestedTxt}>
                {row.meetingDate}{row.meetingTime ? ` at ${row.meetingTime}` : ''}
              </Text>
            </View>
            <Text style={styles.body}>
              {row.meetingCompleted
                ? 'Your meeting has been completed.'
                : `We'll see you then for ${row.patientName}'s admission review.`}
            </Text>
          </View>
        ) : (
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Admission status</Text>
            <Text style={styles.body}>
              Your admission request for <Text style={styles.bold}>{row.patientName}</Text> is currently{' '}
              <Text style={styles.bold}>{row.status.replace(/_/g, ' ')}</Text>. You&apos;ll be notified when there&apos;s an update.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerBack: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: C.navy },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(233,237,247,0.85)',
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: C.navy, marginBottom: 8 },
  body: { fontSize: 13, color: C.muted, lineHeight: 19, marginBottom: 16 },
  bold: { fontWeight: '700', color: C.navy },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: C.navy, marginBottom: 8 },
  emptyBody: { fontSize: 13, color: C.muted, lineHeight: 19, marginBottom: 20 },
  suggestedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  suggestedTxt: { fontSize: 15, fontWeight: '700', color: C.navy },
  orDivider: { textAlign: 'center', fontSize: 12, fontWeight: '700', color: '#94A3B8', marginVertical: 14 },
  noteInput: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    color: C.navy,
    backgroundColor: '#F8FAFC',
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  primaryBtn: {
    backgroundColor: C.orange,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  primaryBtnTxt: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  secondaryBtn: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  secondaryBtnTxt: { color: '#3730A3', fontWeight: '800', fontSize: 14 },
  btnDisabled: { opacity: 0.7 },
});
