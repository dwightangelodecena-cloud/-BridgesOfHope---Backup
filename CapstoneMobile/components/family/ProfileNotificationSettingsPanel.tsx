import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  NOTIFICATION_SOUNDS,
  getSelectedSound,
  setSelectedSound,
  getSoundEnabled,
  setSoundEnabled,
  getMuteUntil,
  setMuteUntil,
  playNotificationSound,
  soundLabel,
} from '../../lib/notificationSound';
import { syncPushSound } from '../../lib/notifications';

const MUTE_QUICK = ['15 min', '1 hour', '4 hours', '8 hours', '24 hours'];
const MUTE_OPTIONS = [...MUTE_QUICK, 'Until I change it'];
const SOUND_OPTIONS = NOTIFICATION_SOUNDS.map((s) => s.label);

/** Mute label → duration in ms (-1 = indefinite). */
const MUTE_MS: Record<string, number> = {
  '15 min': 15 * 60_000,
  '1 hour': 60 * 60_000,
  '4 hours': 4 * 60 * 60_000,
  '8 hours': 8 * 60 * 60_000,
  '24 hours': 24 * 60 * 60_000,
  'Until I change it': -1,
};

const C = {
  orange: '#F54E25',
  orangeLight: '#FF6A3D',
  orangeDark: '#E8441A',
  navy: '#1A2B4A',
  muted: '#64748B',
  white: '#FFFFFF',
  cardBorder: '#E8EDF3',
  // Orange tint (sounds)
  orangeCardBg: '#FFF6F2',
  orangeCardBorder: '#FBD9CC',
  // Blue tint (mute)
  blue: '#2563EB',
  blueCardBg: '#EEF4FF',
  blueCardBorder: '#CBDBFF',
  // Indigo tint (reassurance)
  indigo: '#6366F1',
  indigoCardBg: '#EEF0FF',
  indigoCardBorder: '#D9DCFB',
};

export function ProfileNotificationSettingsPanel() {
  const [soundsEnabled, setSoundsEnabledState] = useState(true);
  const [soundName, setSoundName] = useState('Chime');
  const [showSoundModal, setShowSoundModal] = useState(false);
  const [muteUntil, setMuteUntilLabel] = useState<string>('Until I change it');
  const [showMuteModal, setShowMuteModal] = useState(false);
  const [showSoundsConfirm, setShowSoundsConfirm] = useState(false);
  const [previewMsg, setPreviewMsg] = useState<string | null>(null);

  // Load saved preferences.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [enabled, sound, until] = await Promise.all([
        getSoundEnabled(),
        getSelectedSound(),
        getMuteUntil(),
      ]);
      if (!alive) return;
      setSoundsEnabledState(enabled);
      setSoundName(soundLabel(sound));
      if (until === -1) setMuteUntilLabel('Until I change it');
      else if (until <= Date.now()) setMuteUntilLabel('Not muted');
      else setMuteUntilLabel('Muted');
    })();
    return () => {
      alive = false;
    };
  }, []);

  const enableSounds = (on: boolean) => {
    setSoundsEnabledState(on);
    void setSoundEnabled(on);
  };

  const chooseSound = (label: string) => {
    setSoundName(label);
    setPreviewMsg(null);
    void setSelectedSound(label).then(() => syncPushSound());
    void playNotificationSound({ key: label, ignorePrefs: true }).then((ok) => {
      if (!ok && label.toLowerCase() !== 'silent') {
        setPreviewMsg("Rebuild the dev client to preview sounds.");
      }
    });
  };

  const previewSound = async () => {
    const ok = await playNotificationSound({ key: soundName, ignorePrefs: true });
    setPreviewMsg(
      ok || soundName.toLowerCase() === 'silent'
        ? null
        : "Rebuild the dev client to preview sounds."
    );
  };

  const applyMute = (label: string) => {
    setMuteUntilLabel(label === 'Until I change it' ? 'Until I change it' : label);
    const dur = MUTE_MS[label] ?? -1;
    void setMuteUntil(dur === -1 ? -1 : Date.now() + dur);
  };

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Notification sounds ─────────────────────────────────────── */}
      <View style={[styles.card, styles.cardOrange]}>
        <View style={styles.cardRow}>
          <LinearGradient
            colors={[C.orangeLight, C.orange, C.orangeDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconCircle}
          >
            <Ionicons name="volume-high" size={19} color={C.white} />
          </LinearGradient>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Notification sounds</Text>
            <Text style={styles.rowHint}>Play a sound for new alerts</Text>
          </View>
          <Switch
            value={soundsEnabled}
            onValueChange={(value) => {
              if (!value) {
                setShowSoundsConfirm(true);
              } else {
                enableSounds(true);
              }
            }}
            thumbColor={C.white}
            trackColor={{ false: '#E2E8F0', true: C.orange }}
            ios_backgroundColor="#E2E8F0"
          />
        </View>

        {soundsEnabled ? (
          <>
            <TouchableOpacity
              style={styles.soundRow}
              onPress={() => setShowSoundModal(true)}
              activeOpacity={0.8}
            >
              <View style={styles.soundRowText}>
                <Text style={styles.soundRowLabel}>Sound</Text>
                <Text style={styles.soundRowValue}>{soundName}</Text>
              </View>
              <TouchableOpacity
                style={styles.playBtn}
                onPress={previewSound}
                accessibilityRole="button"
                accessibilityLabel={`Preview ${soundName}`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="play" size={13} color={C.navy} style={{ marginLeft: 2 }} />
              </TouchableOpacity>
              <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
            </TouchableOpacity>
            {previewMsg ? <Text style={styles.previewMsg}>{previewMsg}</Text> : null}
          </>
        ) : null}
      </View>

      {/* ── Mute notifications ──────────────────────────────────────── */}
      <View style={[styles.card, styles.cardBlue]}>
        <View style={styles.cardRow}>
          <View style={[styles.iconCircle, styles.iconCircleBlue]}>
            <Ionicons name="notifications-off" size={18} color={C.white} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Mute notifications</Text>
            <Text style={styles.rowHint}>Pause alerts for a set time</Text>
          </View>
          <TouchableOpacity
            style={styles.muteRight}
            onPress={() => setShowMuteModal(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <Text style={styles.muteValue}>{muteUntil}</Text>
            <Ionicons name="chevron-forward" size={16} color={C.blue} />
          </TouchableOpacity>
        </View>

        <View style={styles.pillRow}>
          {MUTE_QUICK.map((opt) => {
            const selected = opt === muteUntil;
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.pill, selected && styles.pillSelected]}
                onPress={() => applyMute(opt)}
                activeOpacity={0.8}
              >
                <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Reassurance ────────────────────────────────────────────── */}
      <View style={[styles.card, styles.cardIndigo, styles.reassureCard]}>
        <View style={[styles.iconCircle, styles.iconCircleIndigo]}>
          <Ionicons name="shield-checkmark" size={18} color={C.white} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>You&apos;re in control</Text>
          <Text style={styles.rowHint}>
            Change these preferences anytime. We&apos;ll always respect your choices.
          </Text>
        </View>
        <Ionicons name="notifications" size={30} color="rgba(99, 102, 241, 0.35)" />
      </View>

      {/* ── Sound picker ───────────────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={showSoundModal} onRequestClose={() => setShowSoundModal(false)}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowSoundModal(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalHeading}>Notification sound</Text>
            <ScrollView>
              {SOUND_OPTIONS.map((opt) => {
                const selected = opt === soundName;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.optionRow, selected && styles.optionRowSelected]}
                    onPress={() => {
                      chooseSound(opt);
                      setShowSoundModal(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{opt}</Text>
                    {selected ? <Ionicons name="checkmark-circle" size={18} color={C.orange} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Mute picker ────────────────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={showMuteModal} onRequestClose={() => setShowMuteModal(false)}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowMuteModal(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalHeading}>Mute notifications</Text>
            <ScrollView>
              {MUTE_OPTIONS.map((option) => {
                const selected = option === muteUntil;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.optionRow, selected && styles.optionRowSelected]}
                    onPress={() => {
                      applyMute(option);
                      setShowMuteModal(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option}</Text>
                    {selected ? <Ionicons name="checkmark-circle" size={18} color={C.orange} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Turn off sounds confirm ────────────────────────────────── */}
      <Modal
        transparent
        animationType="fade"
        visible={showSoundsConfirm}
        onRequestClose={() => setShowSoundsConfirm(false)}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIconWrap}>
              <Ionicons name="volume-mute-outline" size={26} color={C.orange} />
            </View>
            <Text style={styles.confirmTitle}>Turn off notification sounds?</Text>
            <Text style={styles.confirmText}>You can turn them back on anytime in Notification Settings.</Text>
            <View style={styles.confirmButtonsRow}>
              <TouchableOpacity
                style={styles.confirmSecondaryButton}
                onPress={() => setShowSoundsConfirm(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmPrimaryWrap}
                onPress={() => {
                  enableSounds(false);
                  setShowSoundsConfirm(false);
                }}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={[C.orangeLight, C.orange, C.orangeDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.confirmPrimaryButton}
                >
                  <Text style={styles.confirmPrimaryText}>Turn off</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  content: {
    padding: 18,
    paddingBottom: 14,
    gap: 12,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  cardOrange: {
    backgroundColor: C.orangeCardBg,
    borderColor: C.orangeCardBorder,
  },
  cardBlue: {
    backgroundColor: C.blueCardBg,
    borderColor: C.blueCardBorder,
  },
  cardIndigo: {
    backgroundColor: C.indigoCardBg,
    borderColor: C.indigoCardBorder,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleBlue: {
    backgroundColor: C.blue,
  },
  iconCircleIndigo: {
    backgroundColor: C.indigo,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: C.navy,
    letterSpacing: -0.2,
  },
  rowHint: {
    fontSize: 12.5,
    fontWeight: '500',
    color: C.muted,
    lineHeight: 17,
  },
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.orangeCardBorder,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  soundRowText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  soundRowLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.muted,
  },
  soundRowValue: {
    fontSize: 14,
    fontWeight: '800',
    color: C.navy,
  },
  previewMsg: {
    fontSize: 11.5,
    color: C.muted,
    fontWeight: '500',
    marginTop: 6,
    marginLeft: 4,
  },
  playBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(245, 78, 37, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  muteRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    maxWidth: 140,
  },
  muteValue: {
    fontSize: 13,
    color: C.blue,
    fontWeight: '700',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.blueCardBorder,
  },
  pillSelected: {
    backgroundColor: C.blue,
    borderColor: C.blue,
  },
  pillText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: C.muted,
  },
  pillTextSelected: {
    color: C.white,
  },
  reassureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 21, 40, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    maxHeight: 400,
    borderRadius: 24,
    backgroundColor: C.white,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 12,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    marginBottom: 8,
  },
  modalHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: C.navy,
    paddingHorizontal: 12,
    paddingBottom: 8,
    letterSpacing: 0.2,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 13,
    borderRadius: 12,
  },
  optionRowSelected: {
    backgroundColor: 'rgba(245, 78, 37, 0.08)',
  },
  optionText: {
    fontSize: 14,
    color: C.muted,
    fontWeight: '600',
  },
  optionTextSelected: {
    color: C.navy,
    fontWeight: '800',
  },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 21, 40, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: C.white,
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  confirmIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(245, 78, 37, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: C.navy,
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  confirmText: {
    fontSize: 13,
    color: C.muted,
    marginBottom: 18,
    lineHeight: 19,
    textAlign: 'center',
  },
  confirmButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    alignSelf: 'stretch',
  },
  confirmSecondaryButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmSecondaryText: {
    fontSize: 14,
    color: C.muted,
    fontWeight: '700',
  },
  confirmPrimaryWrap: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  confirmPrimaryButton: {
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmPrimaryText: {
    fontSize: 14,
    color: C.white,
    fontWeight: '800',
  },
});
