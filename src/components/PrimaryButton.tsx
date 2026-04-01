import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export function PrimaryButton(props: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const scheme = useColorScheme();
  const c = Colors[scheme];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      disabled={props.disabled || props.loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: c.tint, opacity: pressed ? 0.9 : 1 },
        props.disabled || props.loading ? styles.disabled : null,
      ]}>
      {props.loading ? (
        <ActivityIndicator color={scheme === 'dark' ? '#0a0a0a' : '#fff'} />
      ) : (
        <Text style={[styles.label, { color: scheme === 'dark' ? '#0a0a0a' : '#fff' }]}>{props.title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    elevation: 0,
  },
  label: { fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.45 },
});
