import React from 'react';
import {
  TouchableOpacity,
  type TouchableOpacityProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type Props = TouchableOpacityProps & {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

export function ScalePressable({ children, style, disabled, ...rest }: Props) {
  return (
    <TouchableOpacity
      {...rest}
      disabled={disabled}
      activeOpacity={0.88}
      style={[style, disabled && { opacity: 0.65 }]}
    >
      {children}
    </TouchableOpacity>
  );
}
