import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/Colors';

type Props = {
  categories: readonly { code: string; label: string }[];
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
};

export default function ScheduleCategorySelector({ categories, value, onChange, disabled = false }: Props) {
  return (
    <View style={styles.list}>
      {categories.map(category => (
        <Pressable key={category.code} onPress={() => onChange(category.code)} disabled={disabled}
          accessibilityRole="radio" accessibilityState={{ checked: value === category.code, disabled }}
          style={[styles.option, value === category.code && styles.selected, disabled && styles.disabled]}>
          <Text style={styles.label}>{category.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  selected: { backgroundColor: 'rgba(255,255,255,0.15)' },
  disabled: { opacity: 0.5 },
  label: { fontFamily: 'SUIT-SemiBold', fontSize: 15, color: Colors.brand.white, flexShrink: 1 },
});
