import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

const MUTE_OPTIONS = ['1 Hour', '5 Hours', '12 Hours', '1 Day', 'Until I change it'];

export default function NotificationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [soundsEnabled, setSoundsEnabled] = useState(false);
  const [muteUntil, setMuteUntil] = useState<string>('Until I change it');
  const [showMuteModal, setShowMuteModal] = useState(false);
  const [showSoundsConfirm, setShowSoundsConfirm] = useState(false);
  const [pendingSoundsValue, setPendingSoundsValue] = useState<boolean | null>(null);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Settings</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Card */}
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Notification sounds</Text>
          <Switch
            value={soundsEnabled}
            onValueChange={(value) => {
              if (!value) {
                setPendingSoundsValue(false);
                setShowSoundsConfirm(true);
              } else {
                setSoundsEnabled(true);
              }
            }}
            thumbColor={soundsEnabled ? '#F54E25' : '#FFFFFF'}
            trackColor={{ false: '#E5E7EB', true: '#FCA5A5' }}
          />
        </View>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.row} onPress={() => setShowMuteModal(true)}>
          <Text style={styles.rowLabel}>Mute Notifications</Text>
          <View style={styles.muteRight}>
            <Text style={styles.muteValue}>{muteUntil}</Text>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Mute options modal */}
      <Modal
        transparent
        animationType="fade"
        visible={showMuteModal}
        onRequestClose={() => setShowMuteModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowMuteModal(false)}
          />
          <View style={styles.modalCard}>
            <ScrollView>
              {MUTE_OPTIONS.map(option => (
                <TouchableOpacity
                  key={option}
                  style={styles.optionRow}
                  onPress={() => {
                    setMuteUntil(option);
                    setShowMuteModal(false);
                  }}
                >
                  <Text style={styles.optionText}>{option}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Confirm turn off sounds */}
      <Modal
        transparent
        animationType="fade"
        visible={showSoundsConfirm}
        onRequestClose={() => {
          setShowSoundsConfirm(false);
          setPendingSoundsValue(null);
        }}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Turn off notification sounds?</Text>
            <Text style={styles.confirmText}>
              You can turn them back on anytime in Notification Settings.
            </Text>
            <View style={styles.confirmButtonsRow}>
              <TouchableOpacity
                style={styles.confirmSecondaryButton}
                onPress={() => {
                  setShowSoundsConfirm(false);
                  setPendingSoundsValue(null);
                }}
              >
                <Text style={styles.confirmSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmPrimaryButton}
                onPress={() => {
                  if (pendingSoundsValue === false) {
                    setSoundsEnabled(false);
                  }
                  setPendingSoundsValue(null);
                  setShowSoundsConfirm(false);
                }}
              >
                <Text style={styles.confirmPrimaryText}>Turn off</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 56,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  card: {
    marginTop: 24,
    marginHorizontal: 16,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  rowLabel: {
    fontSize: 14,
    color: '#111827',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  muteRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  muteValue: {
    fontSize: 12,
    color: '#6B7280',
    marginRight: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalCard: {
    width: '100%',
    maxHeight: 320,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
  },
  optionRow: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  optionText: {
    fontSize: 14,
    color: '#111827',
  },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  confirmCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  confirmText: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 14,
  },
  confirmButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  confirmSecondaryButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
  },
  confirmSecondaryText: {
    fontSize: 14,
    color: '#6B7280',
  },
  confirmPrimaryButton: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: '#F54E25',
  },
  confirmPrimaryText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

