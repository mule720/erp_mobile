import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, RefreshControl } from 'react-native';
import { useAuth } from '../store/AuthContext';
import { useConfirm } from '../store/ConfirmContext';
import { COLORS, FONT, RADIUS } from '../theme';
import * as P from '../api/practice';

const when = (s?: string | null) => (s ? new Date(s).toLocaleDateString() : '');

/** The company's side: an accounting firm asks for access, the company allows all, some or none of it, and can withdraw it at any time. */
export default function AccountantsScreen() {
  const { tenant } = useAuth();
  const confirm = useConfirm();
  const tenantId = tenant?.id || '';
  const [firms, setFirms] = useState<P.FirmLink[]>([]);
  const [scopes, setScopes] = useState<P.Scope[]>([]);
  const [canDecide, setCanDecide] = useState(false);
  const [chosen, setChosen] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await P.fetchAccountants(tenantId);
      setFirms(d.firms); setScopes(d.scopes); setCanDecide(d.canDecide);
      setChosen(c => { const n = { ...c }; d.firms.forEach(f => { if (!n[f.id]) n[f.id] = f.status === 'authorised' ? f.scopes : f.requestedScopes; }); return n; });
    } catch (e: any) { Alert.alert('Could not load', e?.message || 'Please try again.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [tenantId]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<any>, done: string) => {
    setBusy(true);
    try { await fn(); Alert.alert(done); await load(); }
    catch (e: any) { Alert.alert('Not done', e?.message || 'Please try again.'); }
    finally { setBusy(false); }
  };
  const label = (code: string) => scopes.find(x => x.code === code)?.label || code;
  const toggle = (id: string, code: string) => setChosen(c => ({ ...c, [id]: (c[id] || []).includes(code) ? (c[id] || []).filter(x => x !== code) : [...(c[id] || []), code] }));
  const picker = (f: P.FirmLink) => (
    <View style={s.chips}>
      {f.requestedScopes.map(code => (
        <TouchableOpacity key={code} disabled={!canDecide} onPress={() => toggle(f.id, code)} style={[s.chip, (chosen[f.id] || []).includes(code) && s.chipOn]}>
          <Text style={[s.chipTxt, (chosen[f.id] || []).includes(code) && s.chipTxtOn]}>{label(code)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
  const pending = firms.filter(f => f.status === 'requested');
  const held = firms.filter(f => f.status === 'authorised');

  if (loading) return <View style={s.center}><ActivityIndicator color={COLORS.primary} /></View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F1F5F9' }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      <Text style={s.muted}>An accounting firm can ask to work in your books. You decide which areas, you can change your mind at any time, and every visit is recorded.</Text>
      {!canDecide && <Text style={[s.muted, { color: '#B45309', marginTop: 6 }]}>Only a manager or administrator can answer these.</Text>}

      {pending.length > 0 && <Text style={s.group}>Waiting for your answer</Text>}
      {pending.map(f => (
        <View key={f.id} style={[s.card, { borderColor: '#FCD34D', backgroundColor: '#FFFBEB' }]}>
          <Text style={s.bold}>{f.firm} asks to work in your accounts</Text>
          {!!f.message && <Text style={[s.muted, { fontStyle: 'italic' }]}>"{f.message}"</Text>}
          <Text style={s.muted}>Tick only what you are happy for them to do.</Text>
          {picker(f)}
          <View style={s.row}>
            <TouchableOpacity style={[s.btn, (busy || !canDecide || !(chosen[f.id] || []).length) && s.btnOff]} disabled={busy || !canDecide || !(chosen[f.id] || []).length}
              onPress={() => run(() => P.answerRequest(tenantId, f.id, true, chosen[f.id]), 'Access given')}><Text style={s.btnTxt}>Allow</Text></TouchableOpacity>
            <TouchableOpacity style={[s.btnGhost, (busy || !canDecide) && s.btnOff]} disabled={busy || !canDecide}
              onPress={() => run(() => P.answerRequest(tenantId, f.id, false), 'Declined')}><Text style={s.ghostTxt}>Decline</Text></TouchableOpacity>
          </View>
        </View>
      ))}

      <Text style={s.group}>Firms with access</Text>
      {held.length === 0 && <Text style={s.muted}>No accounting firm has access to your accounts.</Text>}
      {held.map(f => (
        <View key={f.id} style={s.card}>
          <Text style={s.bold}>{f.firm}</Text>
          <Text style={s.muted}>Since {when(f.requestedAt)} · {f.visits} visit{f.visits === 1 ? '' : 's'}{f.lastVisit ? `, last on ${when(f.lastVisit)}` : ''}</Text>
          {picker(f)}
          <View style={s.row}>
            <TouchableOpacity style={[s.btnGhost, (busy || !canDecide || !(chosen[f.id] || []).length) && s.btnOff]} disabled={busy || !canDecide || !(chosen[f.id] || []).length}
              onPress={() => run(() => P.changeScopes(tenantId, f.id, chosen[f.id]), 'Saved')}><Text style={s.ghostTxt}>Save what they may do</Text></TouchableOpacity>
            <TouchableOpacity style={[s.btnDanger, (busy || !canDecide) && s.btnOff]} disabled={busy || !canDecide}
              onPress={async () => { if (await confirm({ title: `Withdraw ${f.firm}'s access?`, message: 'Their people are locked out straight away.', confirmLabel: 'Withdraw', destructive: true })) run(() => P.endLink(tenantId, f.id, 'client'), 'Access withdrawn'); }}>
              <Text style={s.btnTxt}>Withdraw access</Text></TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: 14, marginTop: 10, borderWidth: 1, borderColor: '#E2E8F0', gap: 4 },
  group: { fontSize: 15, fontFamily: FONT.heading, color: COLORS.ink, marginTop: 16 },
  bold: { fontSize: 14, fontFamily: FONT.heading, color: COLORS.ink },
  muted: { fontSize: 12, fontFamily: FONT.bodyRegular, color: COLORS.subtle },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 },
  chip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff' },
  chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipTxt: { fontSize: 12, fontFamily: FONT.bodyRegular, color: COLORS.ink },
  chipTxtOn: { color: '#fff' },
  btn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: 16, paddingVertical: 10 },
  btnDanger: { backgroundColor: COLORS.danger, borderRadius: RADIUS.md, paddingHorizontal: 16, paddingVertical: 10 },
  btnOff: { opacity: 0.45 },
  btnTxt: { color: '#fff', fontSize: 13, fontFamily: FONT.heading },
  btnGhost: { borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#CBD5E1' },
  ghostTxt: { fontSize: 13, fontFamily: FONT.heading, color: COLORS.ink },
});
