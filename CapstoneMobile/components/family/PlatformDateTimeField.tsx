import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Mode = 'date' | 'time';

type Props = {
  label: string;
  mode: Mode;
  /** 'YYYY-MM-DD' for date mode, 'HH:MM' for time mode. */
  value: string;
  onChange: (value: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
  error?: boolean;
};

function toDate(mode: Mode, value: string): Date {
  if (mode === 'date') {
    return value ? new Date(`${value}T12:00:00`) : new Date();
  }
  const [h, m] = (value || '09:00').split(':').map((n) => parseInt(n, 10) || 0);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function fromDate(mode: Mode, d: Date): string {
  if (mode === 'date') {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Cross-platform date/time field: native dialog on Android, spinner sheet on iOS,
 * real <input type="date|time"> on web (DateTimePicker has no web implementation).
 */
export function PlatformDateTimeField({ label, mode, value, onChange, minimumDate, maximumDate, placeholder, error }: Props) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(() => toDate(mode, value));

  const openPicker = () => {
    setDraft(toDate(mode, value));
    setOpen(true);
  };

  const display = value || placeholder || (mode === 'date' ? 'Select date' : 'Select time');

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={[styles.shell, error && styles.shellError]} onPress={openPicker} activeOpacity={0.85}>
        <Ionicons name={mode === 'date' ? 'calendar-outline' : 'time-outline'} size={18} color="#64748B" />
        <Text style={[styles.value, !value && styles.placeholderTxt]} numberOfLines={1}>
          {display}
        </Text>
      </TouchableOpacity>

      {Platform.OS === 'android' && open ? (
        <DateTimePicker
          value={draft}
          mode={mode}
          display="default"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(ev, d) => {
            setOpen(false);
            if (ev.type !== 'set' || !d) return;
            onChange(fromDate(mode, d));
          }}
        />
      ) : null}

      <Modal visible={Platform.OS !== 'android' && open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.sheetRoot}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.sheetHeader}>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text style={styles.btnTxt}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.title}>{label}</Text>
              <TouchableOpacity
                onPress={() => {
                  onChange(fromDate(mode, draft));
                  setOpen(false);
                }}
              >
                <Text style={styles.btnPrimaryTxt}>Done</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.pickerWrap}>
              {Platform.OS === 'web'
                ? React.createElement('input', {
                    type: mode,
                    autoFocus: true,
                    value: value || '',
                    ...(mode === 'date' && minimumDate ? { min: fromDate('date', minimumDate) } : {}),
                    ...(mode === 'date' && maximumDate ? { max: fromDate('date', maximumDate) } : {}),
                    onChange: (e: { target: { value: string } }) => {
                      if (e.target.value) onChange(e.target.value);
                    },
                    style: {
                      width: '100%',
                      fontSize: 16,
                      padding: 12,
                      borderRadius: 10,
                      border: '1px solid #E2E8F0',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                    },
                  } as React.ComponentProps<'input'>)
                : (
                  <DateTimePicker
                    value={draft}
                    mode={mode}
                    display="spinner"
                    themeVariant="light"
                    minimumDate={minimumDate}
                    maximumDate={maximumDate}
                    onChange={(_, d) => {
                      if (d) setDraft(d);
                    }}
                  />
                )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    minHeight: 50,
    paddingHorizontal: 14,
    backgroundColor: '#F8FAFC',
  },
  shellError: { borderColor: '#DC2626' },
  value: { flex: 1, fontSize: 15, fontWeight: '500', color: '#1A2B4A' },
  placeholderTxt: { color: '#94A3B8', fontWeight: '400' },
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.35)' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 8 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  title: { fontSize: 14, fontWeight: '800', color: '#1A2B4A' },
  btnTxt: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  btnPrimaryTxt: { fontSize: 14, fontWeight: '800', color: '#F54E25' },
  pickerWrap: { padding: 16, alignItems: 'center' },
});
