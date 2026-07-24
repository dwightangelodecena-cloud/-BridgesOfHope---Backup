import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AUTH_MOBILE, AUTH_BRAND_COPY } from './authMobileTheme';

type BrandVariant = keyof typeof AUTH_BRAND_COPY;

export function AuthMobileShell({
  variant,
  children,
  showBack,
  onBack,
}: {
  variant: BrandVariant;
  children: React.ReactNode;
  showBack?: boolean;
  onBack?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const copy = AUTH_BRAND_COPY[variant];
  const isSignup = variant === 'signup';
  const compactViewport = windowHeight < 740;

  return (
    <View style={styles.page}>
      <LinearGradient
        colors={['#FFF7F4', '#F8FAFC', '#FFFFFF']}
        style={[styles.topGradient, { paddingTop: insets.top + 8 }]}
      >
        {showBack && onBack ? (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={AUTH_MOBILE.navy} />
          </TouchableOpacity>
        ) : null}

        <View style={[styles.compactHeader, showBack && styles.compactHeaderWithBack]}>
          <Image
            source={require('../../assets/images/kalingalogo.png')}
            style={styles.compactLogo}
            resizeMode="contain"
          />
          <View style={styles.compactHeaderText}>
            {copy.eyebrow ? <Text style={styles.eyebrow}>{copy.eyebrow}</Text> : null}
            <Text style={styles.compactTitle} numberOfLines={2}>
              {copy.brandTitle}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView
          style={styles.formScroll}
          contentContainerStyle={[
            styles.formScrollContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formBlock}>
            <Text style={styles.cardHeading}>{copy.heading}</Text>
            <Text style={styles.cardSubtitle}>{copy.subtitle}</Text>

            {!isSignup && !compactViewport ? (
              <View style={styles.featurePills}>
                {copy.features.map((feature) => (
                  <View key={feature} style={styles.featurePill}>
                    <Ionicons name="checkmark-circle" size={14} color={AUTH_MOBILE.orange} />
                    <Text style={styles.featurePillText}>{feature}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export function AuthStatusBanner({
  message,
  tone = 'error',
  style,
}: {
  message: string;
  tone?: 'error' | 'info';
  style?: StyleProp<ViewStyle>;
}) {
  const isInfo = tone === 'info';
  return (
    <View
      style={[
        styles.banner,
        isInfo ? styles.bannerInfo : styles.bannerError,
        style,
      ]}
    >
      <Ionicons
        name={isInfo ? 'information-circle' : 'alert-circle'}
        size={18}
        color={isInfo ? AUTH_MOBILE.infoText : AUTH_MOBILE.errorText}
      />
      <Text style={[styles.bannerText, { color: isInfo ? AUTH_MOBILE.infoText : AUTH_MOBILE.errorText }]}>
        {message}
      </Text>
    </View>
  );
}

export function AuthField({
  label,
  icon,
  error,
  rightElement,
  containerStyle,
  ...inputProps
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  error?: string;
  rightElement?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
} & TextInputProps) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? AUTH_MOBILE.errorText : focused ? AUTH_MOBILE.orange : AUTH_MOBILE.inputBorder;

  return (
    <View style={[styles.fieldBlock, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputRow,
          { borderColor, backgroundColor: focused ? '#FFFFFF' : AUTH_MOBILE.inputBg },
        ]}
      >
        <Ionicons
          name={icon}
          size={20}
          color={focused ? AUTH_MOBILE.orange : AUTH_MOBILE.textPlaceholder}
          style={styles.inputIcon}
        />
        <TextInput
          {...inputProps}
          style={styles.input}
          placeholderTextColor={AUTH_MOBILE.textPlaceholder}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
        />
        {rightElement}
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function AuthPrimaryButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.9}
      style={[styles.primaryWrap, (disabled || loading) && styles.primaryDisabled]}
    >
      <LinearGradient
        colors={[AUTH_MOBILE.orangeLight, AUTH_MOBILE.orangeDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryBtn}
      >
        <Text style={styles.primaryText}>{loading ? 'Please wait…' : label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

export function AuthOrDivider() {
  return (
    <View style={styles.orRow}>
      <View style={styles.orLine} />
      <Text style={styles.orText}>OR</Text>
      <View style={styles.orLine} />
    </View>
  );
}

export function AuthGoogleButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.googleBtn, disabled && styles.googleBtnDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.88}
    >
      <Image source={require('../../assets/images/google-logo.png')} style={styles.googleIcon} />
      <Text style={styles.googleText}>Continue with Google</Text>
    </TouchableOpacity>
  );
}

export function AuthSecurityNote() {
  return (
    <View style={styles.securityNote}>
      <Ionicons name="shield-checkmark-outline" size={16} color={AUTH_MOBILE.orange} />
      <Text style={styles.securityText}>Your information is securely protected and encrypted.</Text>
    </View>
  );
}

export function AuthCheckboxRow({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <TouchableOpacity style={styles.checkRow} onPress={onToggle} activeOpacity={0.85}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Ionicons name="checkmark" size={12} color="#FFFFFF" /> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export function AuthFooterPrompt({
  text,
  linkLabel,
  onPress,
}: {
  text: string;
  linkLabel: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.footerRow}>
      <Text style={styles.footerText}>{text}</Text>
      <TouchableOpacity onPress={onPress} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
        <Text style={styles.footerLink}>{linkLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flex: 1, backgroundColor: '#FFFFFF' },
  topGradient: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  compactHeaderWithBack: {
    marginTop: 0,
  },
  compactLogo: {
    width: 52,
    height: 52,
    flexShrink: 0,
  },
  compactHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: AUTH_MOBILE.orange,
    marginBottom: 2,
  },
  compactTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: AUTH_MOBILE.navy,
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  formScroll: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  formScrollContent: {
    flexGrow: 1,
  },
  formBlock: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  cardHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: AUTH_MOBILE.navy,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: AUTH_MOBILE.textMuted,
    marginBottom: 14,
  },
  featurePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF7F4',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(245, 78, 37, 0.12)',
  },
  featurePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: AUTH_MOBILE.navy,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  bannerError: { backgroundColor: AUTH_MOBILE.errorBg, borderColor: AUTH_MOBILE.errorBorder },
  bannerInfo: { backgroundColor: AUTH_MOBILE.infoBg, borderColor: AUTH_MOBILE.infoBorder },
  bannerText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  fieldBlock: { marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '600', color: AUTH_MOBILE.navy, marginBottom: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: AUTH_MOBILE.navy, paddingVertical: 10 },
  fieldError: { fontSize: 12, color: AUTH_MOBILE.errorText, marginTop: 5, fontWeight: '600' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: AUTH_MOBILE.inputBorder,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: AUTH_MOBILE.orange, borderColor: AUTH_MOBILE.orange },
  checkLabel: { fontSize: 14, color: AUTH_MOBILE.textMuted, fontWeight: '500' },
  primaryWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 4,
    marginBottom: 12,
    shadowColor: AUTH_MOBILE.orangeDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryDisabled: { opacity: 0.72, shadowOpacity: 0, elevation: 0 },
  primaryBtn: { minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  orRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  orLine: { flex: 1, height: 1, backgroundColor: '#E8EDF3' },
  orText: { fontSize: 11, fontWeight: '700', color: AUTH_MOBILE.textPlaceholder, letterSpacing: 0.5 },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: AUTH_MOBILE.inputBorder,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
    gap: 10,
  },
  googleBtnDisabled: { opacity: 0.7 },
  googleIcon: { width: 20, height: 20 },
  googleText: { fontSize: 15, fontWeight: '600', color: AUTH_MOBILE.navy },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    marginBottom: 10,
  },
  securityText: { flex: 1, fontSize: 12, lineHeight: 16, color: AUTH_MOBILE.textMuted, fontWeight: '500' },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingTop: 4,
    paddingBottom: 8,
  },
  footerText: { fontSize: 14, color: AUTH_MOBILE.textMuted },
  footerLink: { fontSize: 14, fontWeight: '800', color: AUTH_MOBILE.orange, marginLeft: 4 },
});
