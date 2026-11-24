import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const NAVY = '#2563EB';
const GOLD = '#0EA5E9';

interface Tab { key: string; label: string; }

interface Props {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
}

export default function ModuleTabs({ tabs, active, onChange }: Props) {
  const [box, setBox] = useState({ view: 0, content: 0, x: 0 });
  const more = box.content - box.view - box.x > 8;      // there are tabs off to the right
  return (
    <View style={s.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scroll} scrollEventThrottle={32}
        onLayout={e => setBox(b => ({ ...b, view: e.nativeEvent.layout.width }))}
        onContentSizeChange={w => setBox(b => ({ ...b, content: w }))}
        onScroll={e => setBox(b => ({ ...b, x: e.nativeEvent.contentOffset.x }))}>
        {tabs.map(tab => {
          const isActive = tab.key === active;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[s.tab, isActive && s.tabActive]}
              onPress={() => onChange(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[s.label, isActive && s.labelActive]}>{tab.label}</Text>
              {isActive && <View style={s.indicator} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {more && <View pointerEvents="none" style={s.more}><Ionicons name="chevron-forward" size={16} color="#64748B" /></View>}
    </View>
  );
}

const s = StyleSheet.create({
  more: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.92)' },
  container: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  scroll: { paddingHorizontal: 12 },
  tab: { paddingHorizontal: 14, paddingVertical: 12, position: 'relative' },
  tabActive: {},
  label: { fontSize: 13, fontWeight: '500', color: '#64748B' },
  labelActive: { color: NAVY, fontWeight: '700' },
  indicator: { position: 'absolute', bottom: 0, left: 14, right: 14, height: 2, backgroundColor: GOLD, borderRadius: 1 },
});
