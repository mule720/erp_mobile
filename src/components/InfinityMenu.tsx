import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOW } from '../theme';

export interface InfinityItem { key: string; label: string; icon: keyof typeof Ionicons.glyphMap }

/** The Infinity button: a round button that floats over every screen and opens all the sections as big round tiles. */
export default function InfinityMenu({ items, activeKey, onSelect, onUseDashboard }: {
  items: InfinityItem[]; activeKey: string; onSelect: (key: string) => void; onUseDashboard: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity style={s.fab} onPress={() => setOpen(true)} activeOpacity={0.85} accessibilityLabel="Open the Infinity menu">
        <Ionicons name="infinite" size={28} color="#fff" />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={s.backdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setOpen(false)} />
          <View style={s.sheet}>
            <View style={s.head}>
              <Ionicons name="infinite" size={22} color={COLORS.amber} />
              <Text style={s.title}>Where to?</Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Ionicons name="close" size={22} color={COLORS.ink} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={s.grid}>
              {items.map(it => (
                <TouchableOpacity key={it.key} style={s.tileWrap} onPress={() => { setOpen(false); onSelect(it.key); }} activeOpacity={0.8}>
                  <View style={[s.tile, it.key === activeKey && s.tileOn]}><Ionicons name={it.icon} size={24} color={it.key === activeKey ? '#fff' : COLORS.navy} /></View>
                  <Text style={s.label} numberOfLines={2}>{it.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={s.switch} onPress={() => { setOpen(false); onUseDashboard(); }}>
              <Ionicons name="menu-outline" size={15} color={COLORS.subtle} /><Text style={s.switchTxt}>Use the hamburger button instead</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  fab: {
    position: 'absolute', right: 18, bottom: Platform.OS === 'ios' ? 34 : 22, width: 58, height: 58, borderRadius: 29,
    backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center', zIndex: 40, borderWidth: 2, borderColor: COLORS.amber, ...SHADOW.raised,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(11,17,32,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 24, maxHeight: '80%' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 18, paddingBottom: 6 },
  title: { fontSize: 17, fontWeight: '800', color: COLORS.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, paddingTop: 8 },
  tileWrap: { width: '25%', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 },
  tile: { width: 58, height: 58, borderRadius: 29, backgroundColor: COLORS.surfaceMuted, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  tileOn: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  label: { fontSize: 11, fontWeight: '600', color: COLORS.ink, textAlign: 'center', marginTop: 6 },
  switch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  switchTxt: { fontSize: 12, color: COLORS.subtle, fontWeight: '600' },
});
