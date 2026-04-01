import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export function SecondaryButton(props: { title: string; onPress: () => void; disabled?: boolean }) {
  const scheme = useColorScheme();
  const c = Colors[scheme];
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(props.disabled) }}
      activeOpacity={0.75}
      disabled={props.disabled}
      onPress={props.onPress}
      style={[
        styles.btn,
        {
          borderColor: c.border,
          backgroundColor: c.surface,
          opacity: props.disabled ? 0.45 : 1,
        },
      ]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Text style={[styles.label, { color: c.text }]}>{props.title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 16, fontWeight: '600' },
});
