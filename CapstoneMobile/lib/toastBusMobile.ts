import { DeviceEventEmitter } from 'react-native';

/** Fire-and-forget toast bus — same DeviceEventEmitter shape already used for FAMILY_NOTIFICATIONS_CHANGED. */
export const TOAST_EVENT = 'BH_TOAST';

export type ToastPayload = {
  id: string;
  type: 'error' | 'success';
  message: string;
  duration: number;
};

export function showToast(message: string, type: 'error' | 'success' = 'error', duration = 4000) {
  if (!message) return;
  const payload: ToastPayload = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    message,
    duration,
  };
  DeviceEventEmitter.emit(TOAST_EVENT, payload);
}

export function showErrorToast(message: string) {
  showToast(message, 'error');
}

export function showSuccessToast(message: string) {
  showToast(message, 'success');
}
