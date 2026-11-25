import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, StyleSheet, Linking, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../store/AuthContext';
import { useConfirm } from '../store/ConfirmContext';
import { COLORS, FONT, RADIUS } from '../theme';
import * as P from '../api/practice';

/** An accounting firm's client companies: find a company and ask, group clients by sector, open a client's books, choose who pays each subscription. */
export default function FirmClientsScreen() {
  const { tenant, enterClient } = useAuth();
  const confirm = useConfirm();
  const tenantId = tenant?.id || '';
  const [ov, setOv] = useState<P.PracticeOverview | null>(null);
  const [scopes, setScopes] = useState<P.Scope[]>([]);
  const [st, setSt] = useState<P.BillingStatement | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [found, setFound] = useState<P.FoundCompany[]>([]);
  const [searched, setSearched] = useState(false);
  const [asking, setAsking] = useState<P.FoundCompany | null>(null);
  const [picked, setPicked] = useState<string[]>(['accounting']);
  const [note, setNote] = useState('');
  const [grouping, setGrouping] = useState<P.FirmClientRow | null>(null);
  const [groupName, setGroupName] = useState('');
  const [sendClient, setSendClient] = useState('');
  const [sendInvoice, setSendInvoice] = useState('');

  const load = useCallback(async () => {
    try {
      const o = await P.fetchOverview(tenantId);
      setOv(o.overview); setScopes(o.scopes);
      if (o.overview?.canManage && o.overview.clients.some(c => c.status === 'authorised')) {
        const b = await P.fetchBilling(tenantId);
        setSt(b.statement); setInvoices(b.invoices);
      } else { setSt(null); }
    } catch (e: any) { Alert.alert('Could not load your clients', e?.message || 'Please try again.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [tenantId]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<any>, done?: string) => {
    setBusy(true);
    try { await fn(); if (done) Alert.alert(done); await load(); return true; }
    catch (e: any) { Alert.alert('Not done', e?.message || 'Please try again.'); return false; }
    finally { setBusy(false); }
  };

  const grouped = useMemo(() => {
    const m = new Map<string, P.FirmClientRow[]>();
    (ov?.clients || []).forEach(c => { const k = c.group || 'Not filed yet'; m.set(k, [...(m.get(k) || []), c]); });
    return [...m.entries()];
  }, [ov]);

  const doSearch = async () => {
    setBusy(true); setSearched(false);
    try { setFound(await P.search(tenantId, text)); setSearched(true); }
    catch (e: any) { Alert.alert('Search failed', e?.message || 'Type at least three letters of the company name, or its TPIN.'); }
    finally { setBusy(false); }
  };
  const ask = async () => {
    if (!asking) return;
    if (await run(() => P.requestAccess(tenantId, asking.id, picked, note), 'Request sent. The company will be asked to authorise it.')) { setAsking(null); setFound([]); setText(''); setNote(''); setSearched(false); }
  };
  const open = async (c: P.FirmClientRow) => {
    setBusy(true);
    try {
      const a = await P.enterClient(tenantId, c.id);
      await enterClient(a.token, a.user, a.tenant, a.refreshToken, tenant?.name || 'your firm');
    } catch (e: any) { Alert.alert('Could not open the books', e?.message || 'Please try again.'); setBusy(false); }
  };
  const remove = async (c: P.FirmClientRow) => {
    if (await confirm({ title: `Remove ${c.name}?`, message: 'Your people lose access to it straight away.', confirmLabel: 'Remove', destructive: true })) await run(() => P.endLink(tenantId, c.id, 'firm'));
  };
  const pay = async (linkIds?: string[]) => {
    setBusy(true);
    try { const url = await P.payClients(tenantId, linkIds); await Linking.openURL(url); }
    catch (e: any) { Alert.alert('Not done', e?.message || 'Please try again.'); }
    finally { setBusy(false); }
  };
  const toggle = (code: string) => setPicked(p => p.includes(code) ? p.filter(x => x !== code) : [...p, code]);
  const authorised = (ov?.clients || []).filter(c => c.status === 'authorised');

  if (loading) return <View style={s.center}><ActivityIndicator color={COLORS.primary} /></View>;
  if (!ov) return <View style={s.center}><Text style={s.muted}>Your clients could not be loaded.</Text></View>;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F1F5F9' }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      <View style={s.card}>
        <Text style={s.title}>{ov.price.clients} client {ov.price.clients === 1 ? 'company' : 'companies'}</Text>
        <Text style={s.muted}>{P.kw(ov.price.basePerMonth)} a month covers {ov.price.included}; {P.kw(ov.price.extraPerClientPerMonth)} for each more.</Text>
        <Text style={s.body}>This month: <Text style={s.bold}>{P.kw(ov.price.perMonth)}</Text></Text>
      </View>

      {ov.canManage && (
        <View style={s.card}>
          <Text style={s.title}>Add a company</Text>
          <View style={s.row}>
            <TextInput style={[s.input, { flex: 1 }]} value={text} onChangeText={setText} placeholder="Company name or TPIN" placeholderTextColor={COLORS.faint} autoCapitalize="none" onSubmitEditing={doSearch} />
            <TouchableOpacity style={[s.btn, text.trim().length < 3 && s.btnOff]} disabled={busy || text.trim().length < 3} onPress={doSearch}><Text style={s.btnTxt}>Search</Text></TouchableOpacity>
          </View>
          {searched && found.length === 0 && <Text style={s.muted}>No company found with that name or TPIN.</Text>}
          {found.map(f => (
            <View key={f.id} style={s.found}>
              <View style={{ flex: 1 }}><Text style={s.bold}>{f.name}</Text><Text style={s.muted}>{[f.city, f.country].filter(Boolean).join(', ')}</Text></View>
              {f.linkStatus ? <Text style={s.badge}>{f.linkStatus === 'requested' ? 'Waiting' : 'Already yours'}</Text>
                : <TouchableOpacity style={s.btnSmall} onPress={() => { setAsking(f); setPicked(['accounting']); }}><Text style={s.btnTxt}>Ask</Text></TouchableOpacity>}
            </View>
          ))}
          {asking && (
            <View style={s.ask}>
              <Text style={s.bold}>Ask {asking.name} to let you work in:</Text>
              <View style={s.chips}>
                {scopes.map(sc => (
                  <TouchableOpacity key={sc.code} onPress={() => toggle(sc.code)} style={[s.chip, picked.includes(sc.code) && s.chipOn]}>
                    <Text style={[s.chipTxt, picked.includes(sc.code) && s.chipTxtOn]}>{sc.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput style={[s.input, { height: 60 }]} value={note} onChangeText={setNote} multiline placeholder="A short note for them (optional)" placeholderTextColor={COLORS.faint} maxLength={1000} />
              <Text style={s.muted}>They decide, and can allow less than you ask. Nothing opens until they authorise it.</Text>
              <View style={s.row}>
                <TouchableOpacity style={[s.btn, (!picked.length || busy) && s.btnOff]} disabled={!picked.length || busy} onPress={ask}><Text style={s.btnTxt}>Send request</Text></TouchableOpacity>
                <TouchableOpacity style={s.btnGhost} onPress={() => setAsking(null)}><Text style={s.ghostTxt}>Cancel</Text></TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {grouped.length === 0 && <Text style={[s.muted, { textAlign: 'center', marginVertical: 20 }]}>No client companies yet. Search for a company above and ask for access.</Text>}
      {grouped.map(([group, rows]) => (
        <View key={group} style={{ marginBottom: 6 }}>
          <Text style={s.group}>{group} ({rows.length})</Text>
          {rows.map(c => (
            <View key={c.id} style={s.card}>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.bold}>{c.name}</Text>
                  <Text style={s.muted}>{[c.city, c.country].filter(Boolean).join(', ')}{c.plan ? ` · ${c.plan}` : ''}</Text>
                  {c.scopes.length > 0 && <Text style={s.muted}>May work in: {c.scopes.join(', ')}</Text>}
                </View>
                <Text style={[s.badge, c.status === 'authorised' ? s.badgeOk : s.badgeWait]}>{c.status === 'authorised' ? 'Authorised' : 'Waiting for them'}</Text>
              </View>
              {c.status === 'authorised' && (
                <View style={[s.row, { marginTop: 8 }]}>
                  <Text style={s.muted}>Subscription paid by</Text>
                  {(['client', 'firm'] as const).map(p => (
                    <TouchableOpacity key={p} disabled={!ov.canManage || busy} onPress={() => c.payer !== p && run(() => P.setPayer(tenantId, c.id, p))} style={[s.chip, c.payer === p && s.chipOn]}>
                      <Text style={[s.chipTxt, c.payer === p && s.chipTxtOn]}>{p === 'client' ? 'the company' : 'us'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <View style={[s.row, { marginTop: 8 }]}>
                {c.status === 'authorised' && <TouchableOpacity style={s.btnSmall} disabled={busy} onPress={() => open(c)}><Ionicons name="log-in-outline" size={14} color="#fff" /><Text style={s.btnTxt}> Open books</Text></TouchableOpacity>}
                {ov.canManage && <TouchableOpacity style={s.btnGhost} onPress={() => { setGrouping(c); setGroupName(c.group); }}><Text style={s.ghostTxt}>Group</Text></TouchableOpacity>}
                {ov.canManage && <TouchableOpacity style={s.btnGhost} disabled={busy} onPress={() => remove(c)}><Text style={[s.ghostTxt, { color: COLORS.danger }]}>Remove</Text></TouchableOpacity>}
              </View>
            </View>
          ))}
        </View>
      ))}

      {st && ov.canManage && (
        <>
          <View style={s.card}>
            <Text style={s.title}>Client subscriptions</Text>
            <Text style={s.muted}>Each company keeps its own invoices. For the companies you pay for, pay one or all of them in a single payment.</Text>
            {st.clients.map(c => (
              <View key={c.linkId} style={[s.row, { marginTop: 8 }]}>
                <View style={{ flex: 1 }}><Text style={s.body}>{c.client}</Text><Text style={s.muted}>{c.payer === 'firm' ? 'You pay' : 'They pay their own'}{c.due > 0 ? ` · owes ${P.kw(c.due)}` : ' · nothing due'}</Text></View>
                {c.payer === 'firm' && c.due > 0 && <TouchableOpacity style={s.btnSmall} disabled={busy} onPress={() => pay([c.linkId])}><Text style={s.btnTxt}>Pay {P.kw(c.due)}</Text></TouchableOpacity>}
              </View>
            ))}
            {st.clients.some(c => c.payer === 'firm') && (
              <TouchableOpacity style={[s.btn, { marginTop: 10 }, st.totalDue <= 0 && s.btnOff]} disabled={busy || st.totalDue <= 0} onPress={() => pay()}>
                <Text style={s.btnTxt}>Pay all we pay for ({P.kw(st.totalDue)})</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={s.card}>
            <Text style={s.title}>Bill a client for your services</Text>
            <Text style={s.muted}>Raise the invoice as usual, then send it here. It reaches the client's supplier bills as a draft for them to review.</Text>
            <Text style={[s.muted, { marginTop: 8 }]}>Client</Text>
            <View style={s.chips}>
              {authorised.map(c => <TouchableOpacity key={c.id} onPress={() => setSendClient(c.id)} style={[s.chip, sendClient === c.id && s.chipOn]}><Text style={[s.chipTxt, sendClient === c.id && s.chipTxtOn]}>{c.name}</Text></TouchableOpacity>)}
            </View>
            <Text style={[s.muted, { marginTop: 8 }]}>Invoice</Text>
            <View style={s.chips}>
              {invoices.slice(0, 12).map(i => <TouchableOpacity key={i.id} onPress={() => setSendInvoice(i.id)} style={[s.chip, sendInvoice === i.id && s.chipOn]}><Text style={[s.chipTxt, sendInvoice === i.id && s.chipTxtOn]}>{i.invoiceNumber} · {i.currency} {i.totalAmount}</Text></TouchableOpacity>)}
              {invoices.length === 0 && <Text style={s.muted}>You have no posted invoices yet.</Text>}
            </View>
            <TouchableOpacity style={[s.btn, { marginTop: 10 }, (!sendClient || !sendInvoice) && s.btnOff]} disabled={busy || !sendClient || !sendInvoice}
              onPress={async () => { if (await run(() => P.sendInvoice(tenantId, sendClient, sendInvoice), 'Sent. It is in the client\'s supplier bills as a draft.')) setSendInvoice(''); }}>
              <Text style={s.btnTxt}>Send to client</Text>
            </TouchableOpacity>
            {st.serviceBills.slice(0, 6).map(b => <Text key={b.id} style={[s.muted, { marginTop: 4 }]}>{b.client}: {b.number}{b.total != null ? ` (${P.kw(b.total)})` : ''}, {b.status}</Text>)}
          </View>
        </>
      )}

      {ov.earlier.length > 0 && <Text style={[s.muted, { marginTop: 6 }]}>Earlier: {ov.earlier.map(c => `${c.name} (${c.statusText})`).join('; ')}</Text>}

      <Modal visible={!!grouping} transparent animationType="fade" onRequestClose={() => setGrouping(null)}>
        <View style={s.backdrop}><View style={s.modal}>
          <Text style={s.title}>Group for {grouping?.name}</Text>
          <Text style={s.muted}>A sector or heading you file clients under, for example Farming, Retail or Schools. Leave empty to un-file.</Text>
          <TextInput style={s.input} value={groupName} onChangeText={setGroupName} placeholder="Sector or group" placeholderTextColor={COLORS.faint} maxLength={80} />
          <View style={s.row}>
            <TouchableOpacity style={s.btn} onPress={async () => { const c = grouping!; setGrouping(null); await run(() => P.setGroup(tenantId, c.id, groupName)); }}><Text style={s.btnTxt}>Save</Text></TouchableOpacity>
            <TouchableOpacity style={s.btnGhost} onPress={() => setGrouping(null)}><Text style={s.ghostTxt}>Cancel</Text></TouchableOpacity>
          </View>
        </View></View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  title: { fontSize: 16, fontFamily: FONT.display, color: COLORS.ink, marginBottom: 4 },
  group: { fontSize: 14, fontFamily: FONT.heading, color: COLORS.ink, marginVertical: 6 },
  body: { fontSize: 14, fontFamily: FONT.bodyRegular, color: COLORS.ink },
  bold: { fontSize: 14, fontFamily: FONT.heading, color: COLORS.ink },
  muted: { fontSize: 12, fontFamily: FONT.bodyRegular, color: COLORS.subtle, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.ink, backgroundColor: '#fff', marginVertical: 6 },
  btn: { flexDirection: 'row', backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: 16, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  btnSmall: { flexDirection: 'row', backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  btnOff: { opacity: 0.45 },
  btnTxt: { color: '#fff', fontSize: 13, fontFamily: FONT.heading },
  btnGhost: { borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#CBD5E1' },
  ghostTxt: { fontSize: 13, fontFamily: FONT.heading, color: COLORS.ink },
  found: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: RADIUS.md, padding: 10, marginTop: 6 },
  ask: { backgroundColor: '#EEF2FF', borderRadius: RADIUS.md, padding: 10, marginTop: 8, gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 },
  chip: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff' },
  chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipTxt: { fontSize: 12, fontFamily: FONT.bodyRegular, color: COLORS.ink },
  chipTxtOn: { color: '#fff' },
  badge: { fontSize: 11, fontFamily: FONT.heading, color: COLORS.subtle },
  badgeOk: { color: '#047857' },
  badgeWait: { color: '#B45309' },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modal: { width: '100%', maxWidth: 380, backgroundColor: '#fff', borderRadius: RADIUS.xl, padding: 18, gap: 4 },
});
