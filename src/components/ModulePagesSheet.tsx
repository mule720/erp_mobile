import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS } from '../theme';
import { MODULE_GROUPS, WEB_PAGES, type WebPage } from '../lib/webPages';
import { useRole } from '../store/RoleContext';

/** Every page the web app has for this module: the phone-built ones open here, the rest open the full web page (inside the app on a phone). */
export default function ModulePagesSheet({ moduleKey, title, visible, onClose, onNavigate, onOpenWeb }: {
  moduleKey: string; title: string; visible: boolean; onClose: () => void;
  onNavigate: (key: string) => void; onOpenWeb: (path: string, title: string) => void;
}) {
  const role = useRole();
  const insets = useSafeAreaInsets();
  const groups = MODULE_GROUPS[moduleKey] || [];
  const pages = WEB_PAGES.filter(p => groups.includes(p.group) && (!p.adminOnly || role.isAdmin || role.isStaff));
  const byGroup = groups.map(g => [g, pages.filter(p => p.group === g)] as const).filter(([, l]) => l.length > 0);

  const go = (p: WebPage) => {
    onClose();
    if (p.native) { onNavigate(p.native); return; }
    if (Platform.OS === 'web') { window.open(`https://netonerppro.com${p.path}`, '_blank'); return; }
    onOpenWeb(p.path, p.label);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[s.sheet, { paddingBottom: insets.bottom }]}>
          <View style={s.head}>
            <Text style={s.title}>All {title} pages</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={COLORS.ink} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            {byGroup.map(([g, list]) => (
              <View key={g}>
                {byGroup.length > 1 && <Text style={s.group}>{g}</Text>}
                {list.map(p => (
                  <TouchableOpacity key={p.path + p.label} style={s.row} onPress={() => go(p)} activeOpacity={0.7}>
                    <Text style={s.label}>{p.label}</Text>
                    <Ionicons name={p.native ? 'phone-portrait-outline' : 'open-outline'} size={14} color={COLORS.faint} />
                  </TouchableOpacity>
                ))}
              </View>
            ))}
            <Text style={s.note}>Pages with a phone icon are built for the phone. The others open the full web page.</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(11,17,32,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '78%' },
  head: { flexDirection: 'row', alignItems: 'center', padding: 18, paddingBottom: 8 },
  title: { flex: 1, fontSize: 16, fontWeight: '800', color: COLORS.ink },
  group: { fontSize: 11, fontWeight: '800', color: COLORS.subtle, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 13, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  label: { flex: 1, fontSize: 14, color: COLORS.ink, fontWeight: '600' },
  note: { fontSize: 11, color: COLORS.subtle, paddingHorizontal: 18, paddingTop: 12 },
});
