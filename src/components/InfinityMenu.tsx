import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Platform, PanResponder, Animated, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOW } from '../theme';

export interface InfinityItem { key: string; label: string; icon: keyof typeof Ionicons.glyphMap }

/** The Infinity button: a round button that floats over every screen and opens all the sections as big round tiles. */
export default function InfinityMenu({ items, activeKey, onSelect, onUseDashboard }: {
  items: InfinityItem[]; activeKey: string; onSelect: (key: string) => void; onUseDashboard: () => void;
}) {
  const [open, setOpen] = useState(false);
  // The button can be dragged anywhere; on release it snaps to the nearest side and the spot is remembered.
  const SIZE = 54;
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = Dimensions.get('window');
  // the button lives between the status bar and the system navigation buttons, never under either
  const minY = insets.top + 8;
  const maxY = H - SIZE - insets.bottom - 12;
  const home = { x: Math.max(10, W - SIZE - 14), y: Math.max(minY, H - insets.bottom - (Platform.OS === 'ios' ? 104 : 92) - SIZE) };
  const pos = useRef(new Animated.ValueXY(home)).current;
  const last = useRef(home);
  const moved = useRef(false);
  useEffect(() => {
    AsyncStorage.getItem('erp_infinity_pos').then(v => {
      if (!v) return;
      try { const p = JSON.parse(v); if (typeof p.x === 'number' && typeof p.y === 'number') { const q = { x: p.x, y: Math.min(Math.max(p.y, minY), maxY) }; last.current = q; pos.setValue(q); } } catch {}
    }).catch(() => {});
  }, []);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { moved.current = false; },
    onPanResponderMove: (_, g) => {
      moved.current = true;
      pos.setValue({ x: last.current.x + g.dx, y: last.current.y + g.dy });
    },
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dx) < 8 && Math.abs(g.dy) < 8) { setOpen(true); return; }   // a tap opens the menu
      const x0 = last.current.x + g.dx, y0 = last.current.y + g.dy;
      const y = Math.min(Math.max(y0, minY), maxY);
      const x = x0 + SIZE / 2 < W / 2 ? 10 : W - SIZE - 10;
      last.current = { x, y };
      Animated.spring(pos, { toValue: { x, y }, useNativeDriver: false, friction: 7 }).start();
      AsyncStorage.setItem('erp_infinity_pos', JSON.stringify({ x, y })).catch(() => {});
    },
  })).current;
  return (
    <>
      <Animated.View style={[s.fab, { left: 0, bottom: undefined, top: 0, transform: pos.getTranslateTransform() }]} {...pan.panHandlers}>
        <View style={s.fabInner} accessibilityRole="button" accessibilityLabel="Open the Infinity menu. Drag to move it.">
          <Ionicons name="infinite" size={28} color="#fff" />
        </View>
      </Animated.View>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={s.backdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setOpen(false)} />
          <View style={[s.sheet, { paddingBottom: Math.max(24, insets.bottom + 12) }]}>
            <View style={s.head}>
              <Ionicons name="infinite" size={22} color={COLORS.primary} />
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
    position: 'absolute', width: 54, height: 54, borderRadius: 27,
    backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center', zIndex: 40, borderWidth: 2, borderColor: '#FFFFFF', ...SHADOW.raised,
  },
  fabInner: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 27 },
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
