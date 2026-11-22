import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Modal, Linking, RefreshControl, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../store/AuthContext';
import { COLORS, RADIUS, SHADOW } from '../theme';
import {
  approvalRadar, collectionsCustomer, collectionsOverview, executiveSummary, leadScores, money0, purchaseRequirements, sendReminder,
  type CollectionDetail, type CollectionRow, type ExecSummary, type Radar, type Requirement,
} from '../api/aiApi';

const LEVEL_COLOR: Record<string, string> = { good: COLORS.success, watch: '#D97706', bad: COLORS.danger, info: COLORS.info };
const PERIODS = [['this_month', 'This month'], ['last_month', 'Last month'], ['last_7_days', '7 days'], ['last_30_days', '30 days']] as const;

function Card({ title, icon, children, right }: { title: string; icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <Ionicons name={icon} size={16} color={COLORS.amber} />
        <Text style={s.cardTitle}>{title}</Text>
        <View style={{ flex: 1 }} />
        {right}
      </View>
      {children}
    </View>
  );
}

const notify = (title: string, msg?: string) => (Platform.OS === 'web' ? window.alert(msg ? `${title}\n${msg}` : title) : Alert.alert(title, msg));

/** Every AI feature that makes sense on a phone, in one place: the summary, what needs attention, who to chase, what to order. */
export default function AICentreScreen({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const { tenant } = useAuth();
  const t = tenant?.id ?? '';
  const [period, setPeriod] = useState<string>('this_month');
  const [summary, setSummary] = useState<ExecSummary | null>(null);
  const [writing, setWriting] = useState(false);
  const [radar, setRadar] = useState<Radar | null>(null);
  const [collections, setCollections] = useState<{ worklist: CollectionRow[]; summary: Record<string, any> } | null>(null);
  const [reqs, setReqs] = useState<Requirement[] | null>(null);
  const [leads, setLeads] = useState<any[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<CollectionDetail | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!t) return;
    // each part is independent: a part the person has no permission for simply stays hidden
    const [a, b, c, d, e] = await Promise.all([
      executiveSummary(t, period, false).catch(() => null), approvalRadar(t),
      collectionsOverview(t).catch(() => null), purchaseRequirements(t).catch(() => null), leadScores(t).catch(() => null),
    ]);
    setSummary(a); setRadar(b); setCollections(c);
    setReqs(((d as any)?.requisitions as Requirement[]) ?? null);
    setLeads(((e as any)?.leads ?? []).filter((x: any) => ['hot', 'warm'].includes(String(x.band || x.temperature || '').toLowerCase())).slice(0, 5));
    setLoading(false);
  }, [t, period]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const writeBriefing = async () => {
    setWriting(true);
    try { setSummary(await executiveSummary(t, period, true)); } catch (e: any) { notify('Could not write the briefing', e?.message); }
    finally { setWriting(false); }
  };

  const openCustomer = async (row: CollectionRow) => {
    setBusy(true);
    try { setCustomer(await collectionsCustomer(t, row.customerId)); } catch (e: any) { notify('Could not open', e?.message); }
    finally { setBusy(false); }
  };

  const contact = (kind: 'wa' | 'sms' | 'call') => {
    if (!customer) return;
    const phone = (customer.phone || '').replace(/[^0-9+]/g, '');
    if (!phone) { notify('No phone number on file for this customer'); return; }
    const text = encodeURIComponent(customer.draft?.sms || customer.draft?.body || '');
    const url = kind === 'wa' ? `https://wa.me/${phone.replace('+', '')}?text=${text}` : kind === 'sms' ? `sms:${phone}${Platform.OS === 'ios' ? '&' : '?'}body=${text}` : `tel:${phone}`;
    Linking.openURL(url).catch(() => notify('Could not open that app on this device'));
  };

  const emailIt = async () => {
    if (!customer?.draft) return;
    setBusy(true);
    try {
      const r = await sendReminder(t, customer.customerId, 'email', customer.draft.body, customer.draft.subject, customer.draftInvoiceIds, customer.draft.total);
      notify(r?.ok ? 'Reminder sent' : 'Not sent', r?.detail || r?.status);
    } catch (e: any) { notify('Not sent', e?.message); } finally { setBusy(false); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={COLORS.navy} /></View>;

  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>

      {/* shortcuts */}
      <View style={s.shortcuts}>
        {([['scan-outline', 'Capture a document', 'capture'], ['sparkles-outline', 'Ask NetOn AI', 'ai_assistant'], ['construct-outline', 'Production planner', 'manufacturing']] as const).map(([icon, label, key]) => (
          <TouchableOpacity key={key} style={s.shortcut} onPress={() => onNavigate?.(key)} activeOpacity={0.8}>
            <Ionicons name={icon} size={20} color={COLORS.navy} /><Text style={s.shortcutTxt}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {summary && (
        <Card title="Your business, in plain words" icon="bulb-outline">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            {PERIODS.map(([k, l]) => (
              <TouchableOpacity key={k} onPress={() => setPeriod(k)} style={[s.chip, period === k && s.chipOn]}><Text style={[s.chipTxt, period === k && { color: '#fff' }]}>{l}</Text></TouchableOpacity>
            ))}
          </ScrollView>
          {summary.headlines.map((h, i) => (
            <View key={i} style={s.line}><View style={[s.dot, { backgroundColor: LEVEL_COLOR[h.level] || COLORS.faint }]} /><Text style={s.lineTxt}>{h.text}</Text></View>
          ))}
          {!!summary.narrative && <Text style={s.narrative}>{summary.narrative}</Text>}
          {(summary.recommendations || []).slice(0, 3).map((r, i) => (
            <View key={i} style={s.reco}><Text style={s.recoAct}>{r.action}</Text><Text style={s.recoWhy}>{r.because}</Text></View>
          ))}
          {summary.narrativeAvailable && !summary.narrative && (
            <TouchableOpacity style={s.btnGhost} onPress={writeBriefing} disabled={writing}>
              {writing ? <ActivityIndicator size="small" /> : <Text style={s.btnGhostTxt}>Write a short briefing</Text>}
            </TouchableOpacity>
          )}
        </Card>
      )}

      {radar && radar.total > 0 && (
        <Card title="Approvals waiting" icon="checkmark-done-outline" right={<Text style={s.meta}>{radar.total} · {money0(radar.valueWaiting)}</Text>}>
          {radar.rows.filter(r => r.level !== 'new').slice(0, 5).map(r => (
            <View key={r.id} style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{r.documentName}</Text>
                <Text style={s.rowSub}>{r.stepName} · {r.ageDays}d{r.requestedBy ? ` · ${r.requestedBy}` : ''}{r.blockedReason ? ` · ${r.blockedReason}` : ''}</Text>
              </View>
              <Text style={[s.tag, { color: r.level === 'blocked' ? COLORS.danger : '#D97706' }]}>{r.level}</Text>
            </View>
          ))}
        </Card>
      )}

      {collections && collections.worklist.length > 0 && (
        <Card title="Who to chase first" icon="call-outline" right={<Text style={s.meta}>{money0(collections.summary?.overdue as number)} overdue</Text>}>
          {collections.worklist.slice(0, 6).map(r => (
            <TouchableOpacity key={r.customerId} style={s.row} onPress={() => openCustomer(r)} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{r.name}</Text>
                <Text style={s.rowSub} numberOfLines={2}>{r.nextAction}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.amt}>{money0(r.overdue || r.outstanding)}</Text>
                <Text style={[s.tag, { color: r.riskBand === 'high' ? COLORS.danger : r.riskBand === 'medium' ? '#D97706' : COLORS.success }]}>{r.riskBand} risk</Text>
              </View>
            </TouchableOpacity>
          ))}
        </Card>
      )}

      {reqs && reqs.length > 0 && (
        <Card title="What to order" icon="cube-outline">
          {reqs.slice(0, 4).map((g, i) => (
            <View key={i} style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{(g as any).supplierName || 'No supplier set'}</Text>
                <Text style={s.rowSub} numberOfLines={2}>{g.lines.slice(0, 3).map(l => l.name).join(', ')}{g.lines.length > 3 ? ` +${g.lines.length - 3} more` : ''}</Text>
              </View>
              <Text style={s.amt}>{money0((g as any).total)}</Text>
            </View>
          ))}
          <TouchableOpacity style={s.btnGhost} onPress={() => onNavigate?.('purchasing')}><Text style={s.btnGhostTxt}>Open Purchasing to raise the orders</Text></TouchableOpacity>
        </Card>
      )}

      {leads && leads.length > 0 && (
        <Card title="Leads worth a call" icon="trending-up-outline">
          {leads.map((l: any) => (
            <View key={l.id} style={s.row}>
              <View style={{ flex: 1 }}><Text style={s.rowTitle}>{l.name || l.title || l.company}</Text><Text style={s.rowSub} numberOfLines={2}>{(l.reasons || []).join(' · ')}</Text></View>
              <Text style={s.amt}>{Math.round(l.score ?? 0)}</Text>
            </View>
          ))}
        </Card>
      )}

      {!summary && !radar && !collections && !reqs && (
        <Text style={s.empty}>Nothing to show yet. These insights appear as your records build up, and depend on your permissions.</Text>
      )}

      <Modal visible={!!customer} animationType="slide" onRequestClose={() => setCustomer(null)}>
        <View style={s.modal}>
          <View style={s.modalHead}>
            <Text style={s.modalTitle}>{customer?.name}</Text>
            <TouchableOpacity onPress={() => setCustomer(null)}><Ionicons name="close" size={24} color={COLORS.ink} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text style={s.rowSub}>Owes {money0(customer?.outstanding)} · overdue {money0(customer?.overdue)} · oldest {customer?.oldestDaysOverdue ?? 0} days</Text>
            {(customer?.riskReasons || []).map((r, i) => <Text key={i} style={s.lineTxt}>• {r}</Text>)}
            <Text style={[s.cardTitle, { marginTop: 14 }]}>Suggested message</Text>
            <Text style={s.draft}>{customer?.draft?.sms || customer?.draft?.body || 'No draft for this customer.'}</Text>
            <Text style={s.hint}>You send it: nothing goes out until you tap a button.</Text>
            <View style={s.actions}>
              <TouchableOpacity style={s.btn} onPress={() => contact('wa')}><Ionicons name="logo-whatsapp" size={16} color="#fff" /><Text style={s.btnTxt}>WhatsApp</Text></TouchableOpacity>
              <TouchableOpacity style={s.btn} onPress={() => contact('sms')}><Ionicons name="chatbubble-outline" size={16} color="#fff" /><Text style={s.btnTxt}>SMS</Text></TouchableOpacity>
              <TouchableOpacity style={s.btn} onPress={() => contact('call')}><Ionicons name="call-outline" size={16} color="#fff" /><Text style={s.btnTxt}>Call</Text></TouchableOpacity>
              {customer?.canEmail && <TouchableOpacity style={s.btn} onPress={emailIt} disabled={busy}><Ionicons name="mail-outline" size={16} color="#fff" /><Text style={s.btnTxt}>Email</Text></TouchableOpacity>}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  shortcuts: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  shortcut: { flex: 1, backgroundColor: '#fff', borderRadius: RADIUS.md, padding: 10, alignItems: 'center', gap: 6, ...SHADOW.card },
  shortcutTxt: { fontSize: 11, fontWeight: '700', color: COLORS.navy, textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: 14, marginBottom: 12, ...SHADOW.card },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  cardTitle: { fontSize: 13, fontWeight: '800', color: COLORS.ink },
  meta: { fontSize: 11, color: COLORS.subtle, fontWeight: '600' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginRight: 6 },
  chipOn: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  chipTxt: { fontSize: 12, fontWeight: '600', color: COLORS.ink },
  line: { flexDirection: 'row', gap: 8, marginBottom: 6, alignItems: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  lineTxt: { flex: 1, fontSize: 13, color: COLORS.ink, lineHeight: 19 },
  narrative: { fontSize: 13, color: COLORS.ink, lineHeight: 20, backgroundColor: COLORS.surfaceMuted, padding: 10, borderRadius: RADIUS.sm, marginTop: 6 },
  reco: { marginTop: 8, padding: 10, backgroundColor: COLORS.infoBg, borderRadius: RADIUS.sm },
  recoAct: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  recoWhy: { fontSize: 12, color: COLORS.subtle, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  rowTitle: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  rowSub: { fontSize: 12, color: COLORS.subtle, marginTop: 2 },
  amt: { fontSize: 13, fontWeight: '800', color: COLORS.ink },
  tag: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  btnGhost: { marginTop: 10, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, paddingVertical: 9, alignItems: 'center' },
  btnGhostTxt: { fontSize: 12, fontWeight: '700', color: COLORS.navy },
  empty: { textAlign: 'center', color: COLORS.subtle, marginTop: 40, paddingHorizontal: 24, lineHeight: 20 },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: Platform.OS === 'ios' ? 52 : 20, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.ink, flex: 1 },
  draft: { fontSize: 13, color: COLORS.ink, lineHeight: 20, backgroundColor: COLORS.surfaceMuted, padding: 12, borderRadius: RADIUS.sm, marginTop: 6 },
  hint: { fontSize: 11, color: COLORS.subtle, marginTop: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.navy, paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.sm },
  btnTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
