import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

const NAVY = '#1E3A5F';

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'decimal-pad' | 'phone-pad';
  required?: boolean;
}

export function Field({ label, value, onChangeText, placeholder, multiline, keyboardType = 'default', required }: FieldProps) {
  return (
    <View style={s.wrap}>
      <Text style={s.label}>{label}{required && <Text style={{ color: '#DC2626' }}> *</Text>}</Text>
      <TextInput
        style={[s.input, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || ''}
        placeholderTextColor="#9CA3AF"
        multiline={multiline}
        keyboardType={keyboardType}
      />
    </View>
  );
}

interface SelectProps {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
  required?: boolean;
}

export function SelectField({ label, value, options, onChange, required }: SelectProps) {
  return (
    <View style={s.wrap}>
      <Text style={s.label}>{label}{required && <Text style={{ color: '#DC2626' }}> *</Text>}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
        <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 4 }}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[s.chip, value === opt.value && s.chipActive]}
              onPress={() => onChange(opt.value)}
              activeOpacity={0.7}
            >
              <Text style={[s.chipTxt, value === opt.value && s.chipTxtActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

interface SectionProps { title: string; }
export function Section({ title }: SectionProps) {
  return <Text style={s.section}>{title}</Text>;
}

const s = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 11, fontSize: 14, color: '#111827',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: NAVY, borderColor: NAVY },
  chipTxt: { fontSize: 13, color: '#374151', fontWeight: '500' },
  chipTxtActive: { color: '#fff', fontWeight: '600' },
  section: {
    fontSize: 11, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase',
    letterSpacing: 0.8, marginTop: 8, marginBottom: 10,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 6,
  },
});
