import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { psgcNameMatchesQuery, sortPsgcOptionsForDisplay } from '../lib/psgcApi';

export type PsgcOption = { code: string; name: string; kind?: 'province' | 'region' };

type Props = {
  label: string;
  description?: string;
  icon: keyof typeof Ionicons.glyphMap;
  options: PsgcOption[];
  valueName: string;
  onSelect: (opt: PsgcOption) => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  emptyText?: string;
  helperText?: string;
  errorText?: string;
};

export function PsgcSearchableSelect({
  label,
  description = '',
  icon,
  options,
  valueName,
  onSelect,
  disabled = false,
  loading = false,
  placeholder = 'Tap to search…',
  emptyText = 'No matches.',
  helperText = '',
  errorText = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim();
    const list = q ? options.filter((o) => psgcNameMatchesQuery(o.name, q)) : options;
    return sortPsgcOptionsForDisplay(list);
  }, [options, query]);

  const showError = Boolean(errorText);
  const dimmed = disabled || loading;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      <TouchableOpacity
        style={[styles.shell, showError && styles.shellError, dimmed && styles.shellDisabled]}
        onPress={() => {
          if (dimmed) return;
          setQuery('');
          setOpen(true);
        }}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Ionicons name={icon} size={20} color="#94A3B8" style={styles.shellIcon} />
        <Text style={[styles.shellText, !valueName && styles.placeholder]} numberOfLines={1}>
          {loading ? 'Loading…' : valueName || placeholder}
        </Text>
        {loading ? <ActivityIndicator size="small" color="#94A3B8" /> : <Ionicons name="chevron-down" size={18} color="#94A3B8" />}
      </TouchableOpacity>
      {helperText && !errorText ? <Text style={styles.helper}>{helperText}</Text> : null}
      {errorText ? <Text style={styles.error}>{errorText}</Text> : null}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalRoot}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={12}>
                <Text style={styles.sheetClose}>Close</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.searchRow}>
              <Ionicons name="search-outline" size={20} color="#94A3B8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Type to filter…"
                placeholderTextColor="#B0B0B0"
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.item}
                  onPress={() => {
                    onSelect(item);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <Text style={styles.itemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 2 },
  description: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 8,
    lineHeight: 16,
  },
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 14,
    minHeight: 50,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  shellError: { borderColor: '#FCA5A5', backgroundColor: '#FFFAFA' },
  shellDisabled: { opacity: 0.65 },
  shellIcon: { marginRight: 8 },
  shellText: { flex: 1, fontSize: 14, color: '#000' },
  placeholder: { color: '#B0B0B0' },
  helper: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
  error: { fontSize: 12, color: '#E53935', marginTop: 4 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '88%',
    paddingBottom: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  sheetClose: { fontSize: 15, fontWeight: '600', color: '#F54E25' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: '#1E293B', paddingVertical: 0 },
  item: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  itemText: { fontSize: 14, color: '#1E293B' },
  empty: { textAlign: 'center', color: '#94A3B8', padding: 24, fontSize: 14 },
});
