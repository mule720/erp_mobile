import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRole } from '../store/RoleContext';
import { COLORS, RADIUS, SHADOW } from '../theme';
import { WEB_PAGES, type WebPage } from '../lib/webPages';

/** Every page the web app has, in the web's own order: native screens open natively, the rest open inside the app. */
export default function AllFeaturesScreen({ onNavigate, onOpenWeb }: { onNavigate?: (key: string) => void; onOpenWeb?: (path: string, title: string) => void }) {
  const role = useRole();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const text = q.trim().toLowerCase();
    const allowed = (p: WebPage) => (!p.staffOnly || role.isStaff) && (!p.adminOnly || role.isAdmin || role.isStaff);
    const by: Record<string, WebPage[]> = {};
    for (const p of WEB_PAGES) {
      if (!allowed(p)) continue;
      if (text && !(p.label.toLowerCase().includes(text) || p.group.toLowerCase().includes(text))) continue;
      (by[p.group] = by[p.group] || []).push(p);
    }
    return Object.entries(by);
  }, [q, role.isAdmin, role.isStaff]);

  const go = (p: WebPage) => (p.native && onNavigate ? onNavigate(p.native) : onOpenWeb?.(p.path, p.label));

  return (
    <View style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
      <View style={{ padding: 12, paddingBottom: 4 }}>
        <View style={s.search}>
          <Ionicons name="search" size={16} color={COLORS.faint} />
          <TextInput style={s.input} placeholder="Find a page, e.g. gratuity, requisitions, MRP" placeholderTextColor={COLORS.faint} value={q} onChangeText={setQ} autoCapitalize="none" />
          {!!q && <TouchableOpacity onPress={() => setQ('')}><Ionicons name="close-circle" size={16} color={COLORS.faint} /></TouchableOpacity>}
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {groups.length === 0 && <Text style={s.empty}>No page matches that.</Text>}
        {groups.map(([group, pages]) => {
          const isOpen = !!q || open[group];
          return (
            <View key={group} style={s.card}>
              <TouchableOpacity style={s.head} onPress={() => setOpen(o => ({ ...o, [group]: !o[group] }))} activeOpacity={0.7}>
                <Text style={s.group}>{group}</Text>
                <Text style={s.count}>{pages.length}</Text>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.subtle} />
              </TouchableOpacity>
              {isOpen && pages.map(p => (
                <TouchableOpacity key={p.group + p.path} style={s.row} onPress={() => go(p)} activeOpacity={0.7}>
                  <Text style={s.label}>{p.label}</Text>
                  <Ionicons name={p.native ? 'phone-portrait-outline' : 'open-outline'} size={14} color={COLORS.faint} />
                </TouchableOpacity>
              ))}
            </View>
          );
        })}
        <Text style={s.note}>Pages marked with a phone icon are built for the phone. The others open the full web page inside the app, signed in as you. What you can see still depends on your role.</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: COLORS.border },
  input: { flex: 1, fontSize: 14, color: COLORS.ink, padding: 0 },
  card: { backgroundColor: '#fff', borderRadius: RADIUS.lg, marginBottom: 10, overflow: 'hidden', ...SHADOW.card },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 },
  group: { flex: 1, fontSize: 14, fontWeight: '800', color: COLORS.ink },
  count: { fontSize: 12, color: COLORS.subtle, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  label: { flex: 1, fontSize: 13, color: COLORS.ink, fontWeight: '600' },
  empty: { textAlign: 'center', color: COLORS.subtle, marginTop: 40 },
  note: { fontSize: 11, color: COLORS.subtle, lineHeight: 17, marginTop: 6 },
});
