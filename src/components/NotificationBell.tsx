import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../store/AuthContext';
import { gql } from '../api/graphql';
import { COLORS, FONT, RADIUS } from '../theme';

interface Note { id: string; category: string; priority: string; title: string; body: string; link: string; isRead: boolean; createdAt: string }

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
};
const ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  approval: 'checkmark-done-outline', invoice: 'receipt-outline', payment: 'card-outline', stock: 'cube-outline', hr: 'people-outline', system: 'information-circle-outline',
};

/** The bell in the top bar, like the web application's: a red count of unread notifications, and a list that opens the thing each one is about. */
export default function NotificationBell({ onOpenLink }: { onOpenLink: (path: string, title: string) => void }) {
  const { tenant } = useAuth();
  const insets = useSafeAreaInsets();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Note[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const t = tenant?.id;

  const count = useCallback(async () => {
    if (!t) return;
    try { setUnread(Number((await gql<any>(`query($t:UUID!){ notificationCount(tenantId:$t) }`, { t }))?.notificationCount?.unread || 0)); } catch { /* the bell just shows no count */ }
  }, [t]);
  const load = useCallback(async () => {
    if (!t) return;
    try { setRows((await gql<any>(`query($t:UUID!){ notifications(tenantId:$t, limit:50) }`, { t }))?.notifications || []); } catch { setRows([]); }
  }, [t]);

  useEffect(() => { count(); const id = setInterval(count, 60000); return () => clearInterval(id); }, [count]);
  useEffect(() => { if (open) load(); }, [open, load]);

  const markRead = async (n: Note) => {
    if (n.isRead) return;
    setRows(r => (r || []).map(x => x.id === n.id ? { ...x, isRead: true } : x));
    setUnread(u => Math.max(0, u - 1));
    try { await gql(`mutation($i:UUID!){ markNotificationRead(notificationId:$i) }`, { i: n.id }); } catch { /* counted again on the next refresh */ }
  };
  const markAll = async () => {
    setRows(r => (r || []).map(x => ({ ...x, isRead: true })));
    setUnread(0);
    try { await gql(`mutation($t:UUID!){ markAllNotificationsRead(tenantId:$t) }`, { t }); } catch { count(); }
  };
  const tap = (n: Note) => {
    markRead(n);
    if (n.link && n.link.startsWith('/')) { setOpen(false); onOpenLink(n.link, n.title); }
  };

  return (
    <>
      <TouchableOpacity onPress={() => setOpen(true)} style={s.btn} activeOpacity={0.7} accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
        <Ionicons name="notifications-outline" size={22} color="#334155" />
        {unread > 0 && <View style={s.badge}><Text style={s.badgeTxt}>{unread > 9 ? '9+' : unread}</Text></View>}
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={s.backdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setOpen(false)} />
          <View style={[s.sheet, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
            <View style={s.head}>
              <Text style={s.title}>Notifications</Text>
              <View style={{ flex: 1 }} />
              {unread > 0 && <TouchableOpacity onPress={markAll} style={{ marginRight: 14 }}><Text style={s.link}>Mark all read</Text></TouchableOpacity>}
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Ionicons name="close" size={22} color={COLORS.ink} /></TouchableOpacity>
            </View>
            {rows === null ? <ActivityIndicator color={COLORS.primary} style={{ margin: 30 }} /> : (
              <FlatList
                data={rows} keyExtractor={n => n.id} style={{ maxHeight: 460 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); await count(); setRefreshing(false); }} />}
                ListEmptyComponent={<View style={s.empty}><Ionicons name="notifications-off-outline" size={28} color={COLORS.faint} /><Text style={s.emptyTxt}>You are all caught up.</Text></View>}
                renderItem={({ item: n }) => (
                  <TouchableOpacity onPress={() => tap(n)} activeOpacity={0.7} style={[s.row, !n.isRead && s.rowNew]}>
                    <View style={[s.dot, { backgroundColor: n.priority === 'high' || n.priority === 'urgent' ? COLORS.dangerBg : COLORS.primarySoft }]}>
                      <Ionicons name={ICON[n.category] || 'notifications-outline'} size={16} color={n.priority === 'high' || n.priority === 'urgent' ? COLORS.danger : COLORS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.rowTitle, !n.isRead && { fontFamily: FONT.heading }]} numberOfLines={2}>{n.title}</Text>
                      {!!n.body && <Text style={s.rowBody} numberOfLines={3}>{n.body}</Text>}
                      <Text style={s.rowTime}>{ago(n.createdAt)}</Text>
                    </View>
                    {!n.isRead && <View style={s.unreadDot} />}
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  btn: { padding: 10 },
  badge: { position: 'absolute', top: 1, right: 1, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: '#fff' },
  badgeTxt: { color: '#fff', fontSize: 9, fontFamily: FONT.display },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  head: { flexDirection: 'row', alignItems: 'center', padding: 18, paddingBottom: 10 },
  title: { fontSize: 17, fontFamily: FONT.display, color: COLORS.ink },
  link: { fontSize: 13, fontFamily: FONT.heading, color: COLORS.primary },
  row: { flexDirection: 'row', gap: 12, paddingHorizontal: 18, paddingVertical: 12, borderTopWidth: 1, borderTopColor: COLORS.border, alignItems: 'flex-start' },
  rowNew: { backgroundColor: COLORS.primarySoft },
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontFamily: FONT.body, color: COLORS.ink },
  rowBody: { fontSize: 12, color: COLORS.subtle, marginTop: 2, lineHeight: 17, fontFamily: FONT.bodyRegular },
  rowTime: { fontSize: 11, color: COLORS.faint, marginTop: 4, fontFamily: FONT.bodyRegular },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginTop: 6 },
  empty: { alignItems: 'center', padding: 36, gap: 8 },
  emptyTxt: { fontSize: 14, color: COLORS.subtle, fontFamily: FONT.body },
});
