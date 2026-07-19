import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Platform,
  type NativeSyntheticEvent,
  type TextInputFocusEventData,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

type Props = {
  onClose: () => void;
};

type Rule = {
  id: string;
  label: string;
  test: (value: string) => boolean;
};

const PASSWORD_RULES: Rule[] = [
  { id: 'len', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { id: 'letter', label: 'Contains a letter', test: (v) => /[A-Za-z]/.test(v) },
  { id: 'number', label: 'Contains a number', test: (v) => /\d/.test(v) },
  { id: 'special', label: 'Contains a special character', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

function getStrengthScore(value: string) {
  if (!value) return 0;
  if (/\s/.test(value)) return 0;
  return PASSWORD_RULES.filter((r) => r.test(value)).length;
}

function PasswordField({
  label,
  value,
  onChangeText,
  placeholder,
  hidden,
  onToggleHidden,
  focused,
  onFocus,
  onBlur,
  matchState,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  hidden: boolean;
  onToggleHidden: () => void;
  focused: boolean;
  onFocus: (e: NativeSyntheticEvent<TextInputFocusEventData>) => void;
  onBlur: (e: NativeSyntheticEvent<TextInputFocusEventData>) => void;
  matchState?: 'match' | 'mismatch' | null;
}) {
  const borderColor =
    matchState === 'match'
      ? '#16A34A'
      : matchState === 'mismatch'
        ? '#DC2626'
        : focused
          ? '#F54E25'
          : '#E2E8F0';
  const bgColor = focused ? '#FFFBF8' : '#FFFFFF';

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, { borderColor, backgroundColor: bgColor }]}>
        <View style={styles.inputIconWrap}>
          <Ionicons name="lock-closed-outline" size={17} color={focused ? '#F54E25' : '#94A3B8'} />
        </View>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          secureTextEntry={hidden}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          {...Platform.select({
            web: { outlineStyle: 'none' as const },
            default: {},
          })}
        />
        <TouchableOpacity
          onPress={onToggleHidden}
          accessibilityRole="button"
          accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
          style={styles.eyeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={18} color="#64748B" />
        </TouchableOpacity>
      </View>
      {matchState === 'match' ? (
        <View style={styles.matchRow}>
          <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
          <Text style={styles.matchText}>Passwords match</Text>
        </View>
      ) : null}
      {matchState === 'mismatch' ? (
        <View style={styles.matchRow}>
          <Ionicons name="alert-circle" size={14} color="#DC2626" />
          <Text style={styles.mismatchText}>Passwords do not match</Text>
        </View>
      ) : null}
    </View>
  );
}

export function ProfileChangePasswordPanel({ onClose }: Props) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hidePassword, setHidePassword] = useState(true);
  const [hideConfirmPassword, setHideConfirmPassword] = useState(true);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [focusedField, setFocusedField] = useState<'password' | 'confirm' | null>(null);

  const strengthScore = getStrengthScore(password);
  const strengthPct = (strengthScore / PASSWORD_RULES.length) * 100;
  const hasSpace = /\s/.test(password);

  const confirmMatchState = useMemo(() => {
    if (!confirmPassword) return null;
    return password === confirmPassword ? 'match' : 'mismatch';
  }, [password, confirmPassword]);

  const canSubmit =
    strengthScore === PASSWORD_RULES.length &&
    !hasSpace &&
    password === confirmPassword &&
    password.length > 0;

  const handleConfirmNewPassword = async () => {
    setWarningMessage(null);

    if (!password.trim() || !confirmPassword.trim()) {
      setWarningMessage('Please fill in both password fields.');
      return;
    }
    if (password !== confirmPassword) {
      setWarningMessage('Passwords do not match.');
      return;
    }
    if (strengthScore !== PASSWORD_RULES.length || hasSpace) {
      setWarningMessage('Please meet all password requirements.');
      return;
    }
    if (!isSupabaseConfigured()) {
      setWarningMessage('Supabase is not configured for this build.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setWarningMessage(error.message || 'Could not update password.');
        return;
      }
      setPasswordChanged(true);
    } catch (e) {
      setWarningMessage(e instanceof Error ? e.message : 'Could not update password.');
    } finally {
      setSaving(false);
    }
  };

  const strengthColors =
    strengthScore <= 1 ? ['#FCA5A5', '#F87171'] : strengthScore <= 3 ? ['#FCD34D', '#F59E0B'] : ['#4ADE80', '#16A34A'];

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.tipCard}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#F54E25" />
          <Text style={styles.tipText}>
            Choose a strong password you have not used elsewhere. You will stay signed in after updating.
          </Text>
        </View>

        <PasswordField
          label="New password"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (warningMessage) setWarningMessage(null);
          }}
          placeholder="Enter new password"
          hidden={hidePassword}
          onToggleHidden={() => setHidePassword((prev) => !prev)}
          focused={focusedField === 'password'}
          onFocus={() => setFocusedField('password')}
          onBlur={() => setFocusedField((f) => (f === 'password' ? null : f))}
        />

        {password ? (
          <View style={styles.strengthBlock}>
            <View style={styles.strengthTrack}>
              <LinearGradient
                colors={strengthColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.strengthFill, { width: `${Math.max(strengthPct, 8)}%` }]}
              />
            </View>
            <Text style={styles.strengthLabel}>
              {hasSpace
                ? 'Remove spaces from your password'
                : strengthScore === PASSWORD_RULES.length
                  ? 'Strong password'
                  : 'Password strength'}
            </Text>
          </View>
        ) : null}

        <View style={styles.rulesCard}>
          {PASSWORD_RULES.map((rule) => {
            const met = password ? rule.test(password) && !hasSpace : false;
            return (
              <View key={rule.id} style={styles.ruleRow}>
                <Ionicons
                  name={met ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={met ? '#16A34A' : '#CBD5E1'}
                />
                <Text style={[styles.ruleText, met && styles.ruleTextMet]}>{rule.label}</Text>
              </View>
            );
          })}
        </View>

        <PasswordField
          label="Confirm password"
          value={confirmPassword}
          onChangeText={(text) => {
            setConfirmPassword(text);
            if (warningMessage) setWarningMessage(null);
          }}
          placeholder="Re-enter new password"
          hidden={hideConfirmPassword}
          onToggleHidden={() => setHideConfirmPassword((prev) => !prev)}
          focused={focusedField === 'confirm'}
          onFocus={() => setFocusedField('confirm')}
          onBlur={() => setFocusedField((f) => (f === 'confirm' ? null : f))}
          matchState={confirmMatchState}
        />

        {warningMessage ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color="#DC2626" />
            <Text style={styles.errorText}>{warningMessage}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.primaryBtn, (!canSubmit || saving) && styles.primaryBtnDisabled]}
          onPress={() => void handleConfirmNewPassword()}
          disabled={!canSubmit || saving}
          activeOpacity={0.88}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryBtnText}>Update password</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={passwordChanged} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.successBackdrop}>
          <View style={styles.successCard}>
            <View style={styles.successIconWrap}>
              <Ionicons name="checkmark-circle" size={40} color="#16A34A" />
            </View>
            <Text style={styles.successTitle}>Password updated</Text>
            <Text style={styles.successText}>Your password has been changed successfully.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={onClose} activeOpacity={0.88}>
              <Text style={styles.primaryBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 18,
    paddingBottom: 32,
    gap: 4,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#7C2D12',
    fontWeight: '600',
  },
  fieldBlock: {
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingRight: 10,
    minHeight: 52,
  },
  inputIconWrap: {
    width: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    paddingVertical: 12,
    paddingRight: 4,
    ...Platform.select({
      web: { outlineStyle: 'none' },
      default: {},
    }),
  },
  eyeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    marginLeft: 2,
  },
  matchText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
  },
  mismatchText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  strengthBlock: {
    marginTop: 4,
    marginBottom: 10,
    gap: 6,
  },
  strengthTrack: {
    height: 5,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 999,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  rulesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    padding: 14,
    gap: 10,
    marginBottom: 14,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ruleText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  ruleTextMet: {
    color: '#166534',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#B91C1C',
    fontWeight: '600',
    lineHeight: 18,
  },
  primaryBtn: {
    marginTop: 6,
    backgroundColor: '#F54E25',
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    shadowColor: '#F54E25',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryBtnDisabled: {
    opacity: 0.45,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  successBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  successCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E9EDF7',
  },
  successIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  successText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
  },
});
