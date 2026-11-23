import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../store/AuthContext';
import { gql } from '../api/graphql';
import { COLORS, RADIUS, SHADOW } from '../theme';

interface Line { code: string; kind: string; name: string; reason: string; addedBecauseNeeded: boolean; perMonth: number; perYear: number }
interface Suggestion {
  ok: boolean; error?: string; source: 'ai' | 'rules'; summary: string; planCode: string; billingCycle: 'yearly' | 'monthly';
  modules: string[]; aiAssistant: boolean; lines: Line[]; totalPerMonth: number; totalPerYear: number; note: string;
}
const kw = (n: number) => `K${Math.round(n).toLocaleString()}`;

/** Describe the business, get a suggested plan, modules and NetOn AI with the reason and price of each, and switch it on only after authorising. */
export default function SetupAdvisorScreen() {
  const { tenant } = useAuth();
  const [about, setAbout] = useState('');
  const [cycle, setCycle] = useState<'yearly' | 'monthly'>('yearly');
  const [busy, setBusy] = useState(false);
  const [s, setS] = useState<Suggestion | null>(null);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');

  const ask = async () => {
    setBusy(true); setError(''); setDone(''); setS(null);
    try {
      const d = await gql<any>(`query($t:UUID!,$a:String!,$c:String){ suggestSetup(tenantId:$t, about:$a, billingCycle:$c) }`, { t: tenant!.id, a: about, c: cycle });
      const r: Suggestion = d?.suggestSetup;
      if (r?.ok) setS(r); else setError(r?.error || 'Could not make a suggestion. Try again.');
    } catch (e: any) { setError(e?.message || 'Could not make a suggestion. Try again.'); }
    finally { setBusy(false); }
  };

  const doAuthorise = async () => {
    if (!s) return;
    setBusy(true);
    try {
      const d = await gql<any>(
        `mutation($t:UUID!,$p:String!,$m:[String],$ai:Boolean,$c:String){ applySuggestedSetup(tenantId:$t, planCode:$p, modules:$m, aiAssistant:$ai, billingCycle:$c, authorised:true){ ok error message } }`,
        { t: tenant!.id, p: s.planCode, m: s.modules, ai: s.aiAssistant, c: s.billingCycle });
      const r = d?.applySuggestedSetup;
      if (r?.ok) { setDone(r.message); setS(null); } else Alert.alert('Could not switch it on', r?.error || 'Ask an administrator.');
    } catch (e: any) { Alert.alert('Could not switch it on', e?.message || 'Try again.'); }
    finally { setBusy(false); }
  };

  const authorise = () => {
    if (!s) return;
    const total = s.billingCycle === 'yearly' ? `${kw(s.totalPerYear)} a year` : `${kw(s.totalPerMonth)} a month`;
    Alert.alert('Authorise this setup?', `This switches on everything listed and adds ${total} to your next invoice.`, [
      { text: 'Cancel', style: 'cancel' }, { text: 'Authorise', onPress: doAuthorise },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F1F5F9' }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <View style={st.card}>
        <Text style={st.title}>Not sure what to subscribe to?</Text>
        <Text style={st.sub}>Tell us about the business. We suggest a setup, show what each part does and costs, and switch it on only when you authorise it. This help is free and does not use your AI allowance.</Text>
        <TextInput
          value={about} onChangeText={setAbout} multiline maxLength={1500} style={st.input}
          placeholder="For example: We run a bakery with two shops and 12 staff. We make bread from recipes, sell at the counter, pay salaries and need proper accounts and VAT."
          placeholderTextColor={COLORS.faint}
        />
        <View style={st.row}>
          {(['yearly', 'monthly'] as const).map(c => (
            <TouchableOpacity key={c} onPress={() => setCycle(c)} style={[st.pill, cycle === c && st.pillOn]}>
              <Text style={[st.pillTxt, cycle === c && st.pillTxtOn]}>{c === 'yearly' ? 'Pay yearly' : 'Pay monthly'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={[st.btn, (busy || about.trim().length < 8) && { opacity: 0.5 }]} disabled={busy || about.trim().length < 8} onPress={ask}>
          {busy && !s ? <ActivityIndicator color="#fff" /> : <Text style={st.btnTxt}>Suggest a setup</Text>}
        </TouchableOpacity>
        {!!error && <Text style={st.err}>{error}</Text>}
        {!!done && <Text style={st.ok}>{done}</Text>}
      </View>

      {s && (
        <View style={[st.card, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A', borderWidth: 1 }]}>
          <Text style={st.summary}>{s.summary}</Text>
          {s.lines.map(l => (
            <View key={l.code} style={st.line}>
              <View style={{ flex: 1 }}>
                <Text style={st.lineName}>{l.name}{l.addedBecauseNeeded ? '  · added because it is needed' : ''}</Text>
                <Text style={st.lineWhy}>{l.reason}</Text>
              </View>
              <Text style={st.linePrice}>{s.billingCycle === 'yearly' ? `${kw(l.perYear)}/yr` : `${kw(l.perMonth)}/mo`}</Text>
            </View>
          ))}
          <View style={st.total}>
            <Text style={st.totalTxt}>Total {s.source === 'ai' ? '(suggested by AI)' : '(from your description)'}</Text>
            <Text style={st.totalTxt}>{s.billingCycle === 'yearly' ? `${kw(s.totalPerYear)} a year` : `${kw(s.totalPerMonth)} a month`}</Text>
          </View>
          <Text style={st.note}>{s.note}</Text>
          <View style={st.row}>
            <TouchableOpacity style={[st.btn, { flex: 1 }, busy && { opacity: 0.5 }]} disabled={busy} onPress={authorise}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={st.btnTxt}>Authorise and switch on</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[st.btn, st.btnGhost]} disabled={busy} onPress={() => setS(null)}>
              <Text style={[st.btnTxt, { color: COLORS.ink }]}>Not now</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <Text style={st.foot}><Ionicons name="information-circle-outline" size={12} /> You can see the invoices, and choose who pays for each branch, under All features, Billing.</Text>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: 14, marginBottom: 12, ...SHADOW.card },
  title: { fontSize: 15, fontWeight: '800', color: COLORS.ink },
  sub: { fontSize: 12, color: COLORS.subtle, marginTop: 4, lineHeight: 17 },
  input: { minHeight: 90, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 10, fontSize: 14, color: COLORS.ink, marginTop: 10, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  pill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff' },
  pillOn: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  pillTxt: { fontSize: 12, fontWeight: '700', color: COLORS.ink },
  pillTxtOn: { color: '#fff' },
  btn: { backgroundColor: COLORS.navy, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center', paddingHorizontal: 14, marginTop: 10 },
  btnGhost: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border },
  btnTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  err: { color: '#DC2626', fontSize: 13, marginTop: 8 },
  ok: { color: '#047857', fontSize: 13, marginTop: 8, fontWeight: '600' },
  summary: { fontSize: 13, color: '#92400E', lineHeight: 19, marginBottom: 8 },
  line: { flexDirection: 'row', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#FDE68A' },
  lineName: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  lineWhy: { fontSize: 11, color: COLORS.subtle, marginTop: 2, lineHeight: 16 },
  linePrice: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  total: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#FDE68A', paddingTop: 10, marginTop: 4 },
  totalTxt: { fontSize: 13, fontWeight: '800', color: COLORS.ink },
  note: { fontSize: 11, color: COLORS.subtle, marginTop: 6, lineHeight: 16 },
  foot: { fontSize: 11, color: COLORS.subtle, textAlign: 'center', marginTop: 6, lineHeight: 16 },
});
