import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

const NAVY = '#1E3A5F';
const GOLD = '#C9A84C';

interface Tab { key: string; label: string; }

interface Props {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
}

export default function ModuleTabs({ tabs, active, onChange }: Props) {
  return (
    <View style={s.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scroll}>
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
    </View>
  );
}

const s = StyleSheet.create({
  container: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  scroll: { paddingHorizontal: 12 },
  tab: { paddingHorizontal: 14, paddingVertical: 12, position: 'relative' },
  tabActive: {},
  label: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  labelActive: { color: NAVY, fontWeight: '700' },
  indicator: { position: 'absolute', bottom: 0, left: 14, right: 14, height: 2, backgroundColor: GOLD, borderRadius: 1 },
});
