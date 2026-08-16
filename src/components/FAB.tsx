import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

const NAVY = '#1E3A5F';

interface Props { onPress: () => void; label?: string; }

export default function FAB({ onPress, label = '+' }: Props) {
  return (
    <TouchableOpacity style={s.fab} onPress={onPress} activeOpacity={0.85}>
      <Text style={s.txt}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: NAVY,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, elevation: 8,
  },
  txt: { color: '#fff', fontSize: 26, lineHeight: 28, fontWeight: '400' },
});
