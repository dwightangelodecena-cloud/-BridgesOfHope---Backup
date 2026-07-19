import React, { useState, forwardRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const C = {
  orange: '#F54E25',
  navy: '#1A2B4A',
  muted: '#64748B',
  placeholder: '#94A3B8',
  border: '#E2E8F0',
  inputBg: '#F8FAFC',
  error: '#DC2626',
};

type Props = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  error?: boolean;
  rightElement?: React.ReactNode;
  showClear?: boolean;
  onClear?: () => void;
} & TextInputProps;

export const LoginField = forwardRef<TextInput, Props>(function LoginField(
  {
    label,
    icon,
    error,
    rightElement,
    showClear,
    onClear,
    value,
    onFocus,
    onBlur,
    ...inputProps
  },
  ref
) {
  const [focused, setFocused] = useState(false);
  const filled = typeof value === 'string' && value.length > 0;
  const active = focused || filled;

  const borderColor = error ? C.error : focused ? C.orange : filled ? '#CBD5E1' : C.border;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
      <View
        style={[
          styles.row,
          {
            borderColor,
            backgroundColor: focused ? '#FFFFFF' : C.inputBg,
          },
          focused && styles.rowFocused,
        ]}
      >
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={18} color={focused ? C.orange : C.placeholder} />
        </View>
        <TextInput
          ref={ref}
          {...inputProps}
          value={value}
          style={styles.input}
          placeholderTextColor={C.placeholder}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...Platform.select({
            web: {
              outlineStyle: 'none' as const,
              outlineWidth: 0,
            },
            default: {},
          })}
        />
        {showClear && filled ? (
          <TouchableOpacity onPress={onClear} hitSlop={8} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={18} color={C.placeholder} />
          </TouchableOpacity>
        ) : null}
        {rightElement}
      </View>
    </View>
  );
});

LoginField.displayName = 'LoginField';

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: C.muted,
    marginBottom: 6,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  labelActive: { color: C.navy },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    minHeight: 54,
    paddingRight: 14,
  },
  rowFocused: Platform.select({
    web: {},
    default: {
      shadowColor: C.orange,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.14,
      shadowRadius: 10,
      elevation: 2,
    },
  }),
  iconBox: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: C.navy,
    paddingVertical: 14,
    fontWeight: '500',
    ...Platform.select({
      web: {
        outlineStyle: 'none' as const,
        outlineWidth: 0,
      },
      default: {},
    }),
  },
  clearBtn: { marginLeft: 4 },
});
