import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS } from '../theme';

/** A labelled drop-down that opens a list: for choosing a supplier, employee, product or warehouse. */
export default function PickField({ label, value, items, onPick, placeholder = 'Choose…' }: {
  label?: string; value: string; items: { id: string; name: string }[]; onPick: (id: string) => void; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const chosen = items.find(i => i.id === value);
  return (
    <View style={{ marginBottom: 10 }}>
      {!!label && <Text style={s.label}>{label}</Text>}
      <TouchableOpacity style={s.select} onPress={() => setOpen(true)}>
        <Text style={{ color: chosen ? COLORS.ink : COLORS.faint, flex: 1 }} numberOfLines={1}>{chosen?.name || placeholder}</Text>
        <Ionicons name="chevron-down" size={16} color={COLORS.subtle} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={s.sheet}>
            <ScrollView>
              {items.length === 0 && <Text style={s.none}>Nothing to choose from yet.</Text>}
              {items.map(i => (
                <TouchableOpacity key={i.id} style={s.opt} onPress={() => { onPick(i.id); setOpen(false); }}><Text style={s.optTxt}>{i.name}</Text></TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 5 },
  select: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: '#fff' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: '#fff', borderRadius: RADIUS.lg, maxHeight: '70%' },
  opt: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  optTxt: { fontSize: 14, color: COLORS.ink },
  none: { padding: 16, color: COLORS.subtle },
});
