import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, DeviceEventEmitter, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TOAST_EVENT, type ToastPayload } from '../lib/toastBusMobile';

/** Mounted once (app/_layout.tsx) — renders whatever showToast()/showErrorToast() fires from anywhere. */
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<ToastPayload[]>([]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(TOAST_EVENT, (t: ToastPayload) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, t.duration || 4000);
    });
    return () => sub.remove();
  }, []);

  if (!toasts.length) return null;

  return (
    <View pointerEvents="box-none" style={[styles.root, { top: insets.top + 8 }]}>
      {toasts.map((t) => (
        <Pressable
          key={t.id}
          onPress={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
          style={[styles.toast, t.type === 'error' ? styles.error : styles.success]}
        >
          <Ionicons
            name={t.type === 'error' ? 'alert-circle' : 'checkmark-circle'}
            size={16}
            color={t.type === 'error' ? '#7F1D1D' : '#065F46'}
          />
          <Text style={[styles.text, { color: t.type === 'error' ? '#7F1D1D' : '#065F46' }]}>{t.message}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 12, right: 12, zIndex: 99999, gap: 8 },
  toast: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  error: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  success: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  text: { flex: 1, fontSize: 13, fontWeight: '600' },
});
