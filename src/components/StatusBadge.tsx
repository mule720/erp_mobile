import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const COLORS: Record<string, { bg: string; text: string }> = {
  draft:      { bg: '#F3F4F6', text: '#6B7280' },
  pending:    { bg: '#FEF3C7', text: '#D97706' },
  approved:   { bg: '#D1FAE5', text: '#059669' },
  paid:       { bg: '#D1FAE5', text: '#059669' },
  sent:       { bg: '#DBEAFE', text: '#2563EB' },
  overdue:    { bg: '#FEE2E2', text: '#DC2626' },
  rejected:   { bg: '#FEE2E2', text: '#DC2626' },
  cancelled:  { bg: '#F3F4F6', text: '#6B7280' },
  confirmed:  { bg: '#D1FAE5', text: '#059669' },
  active:     { bg: '#D1FAE5', text: '#059669' },
  inactive:   { bg: '#F3F4F6', text: '#6B7280' },
  calculated: { bg: '#EDE9FE', text: '#7C3AED' },
  posted:     { bg: '#D1FAE5', text: '#059669' },
  void:       { bg: '#F3F4F6', text: '#6B7280' },
  open:       { bg: '#DBEAFE', text: '#2563EB' },
  received:   { bg: '#D1FAE5', text: '#059669' },
  partial:    { bg: '#FEF3C7', text: '#D97706' },
};

export default function StatusBadge({ status }: { status: string }) {
  const key = (status || '').toLowerCase();
  const c = COLORS[key] || { bg: '#F3F4F6', text: '#6B7280' };
  return (
    <View style={[s.badge, { backgroundColor: c.bg }]}>
      <Text style={[s.text, { color: c.text }]}>{status?.toUpperCase()}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  text: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
});
